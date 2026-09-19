#!/usr/bin/env python3
"""
ci/preflight.py -- static Java preflight gate for the Devouring Storms build.

WHY THIS EXISTS
---------------
The sandbox that authors this mod has no JDK and no route to Maven/Mojang, so
javac only ever runs on the GitHub runner. Every mechanical Java mistake
therefore costs a full CI round trip: edit -> push -> runner -> red.

That cost is measurable in this repository. Of the 152 build runs recorded in
ci-out/, 43 died at javac. Reading their JAVAC_FAILED.txt files, the errors
cluster into a handful of classes that a static reader can catch WITHOUT a
compiler:

    class                        corpus count   caught by
    ---------------------------  ------------   ---------------------------
    cannot find symbol                   134   unused-import, api-drift*
    incompatible types                    33   lossy-float
    moved/renamed API                     32   api-drift*
    lambda capture not final              17   lambda-capture
    duplicate local variable               4   dup-local
    unbalanced delimiter/braces            --   balance
    constructor-lookalike declarator       *    multidecl

    * api-drift reports as an ADVISORY note and never fails the gate. The only
      API description available here is `javap -p`, which lists *declared*
      members only -- inherited methods are invisible, so "not in the dump"
      cannot be distinguished from "inherited". See the note in check_api_drift.

ci/check_java_balance.py already implemented the delimiter half of this, and it
is good code -- but ci/build.sh never called it, so it never protected a single
build. This script folds that check in, adds the classes above, and is wired
into build.sh so it runs before javac.

DESIGN RULE
-----------
No compiler, no type system. This is a lint, not a javac. It is tuned so that
every reported finding is a real defect, because a preflight that cries wolf
gets switched off and then protects nothing. Every check therefore reduces to
"provably wrong from the text alone". Where a check would need real type
inference, it is not attempted, and that limitation is documented at the check.

USAGE
-----
    python3 ci/preflight.py <file.java> [more.java ...]
    python3 ci/preflight.py --roots          # the roots ci/build.sh compiles
    python3 ci/preflight.py --roots --json

EXIT
----
    0  clean (advisory notes may still print)
    1  findings present
    2  bad invocation
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys

# --------------------------------------------------------------------------
# Source roots ci/build.sh actually compiles.
#
# build.sh:1231 runs:
#     find mcsm-extras/java -name '*.java' ! -path '*/net/mcsm/sift/*' \
#          ! -name 'McsmNpcRenderer.java' ! -name 'McsmAnimatedSkybox.java' \
#          ! -name 'McsmVoidRudder.java'
# plus the WitherStormP* model files out of src-recon.
#
# net/ and src-recon/ are decompiled dumps of the BASE mod -- "import
# [Lnet.minecraft.world.phys.Vec3;;" is a decompiler artefact, not source --
# and are never compiled, so they are excluded here. Reporting on files that
# cannot affect a build is how a gate loses its authority.
# --------------------------------------------------------------------------
COMPILED_ROOT = "mcsm-extras/java"
EXCLUDE_PATH = ("/net/mcsm/sift/",)
EXCLUDE_NAMES = ("McsmNpcRenderer.java", "McsmAnimatedSkybox.java", "McsmVoidRudder.java")
MODEL_ROOT = "src-recon/net/dabicco/witherstormmod/entity/model"
MODEL_GLOB = re.compile(r"WitherStormP.*\.java$")

KEYWORDS = {
    "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char",
    "class", "const", "continue", "default", "do", "double", "else", "enum",
    "extends", "final", "finally", "float", "for", "goto", "if", "implements",
    "import", "instanceof", "int", "interface", "long", "native", "new",
    "package", "private", "protected", "public", "return", "short", "static",
    "strictfp", "super", "switch", "synchronized", "this", "throw", "throws",
    "transient", "try", "void", "volatile", "while", "record", "sealed",
    "permits", "var", "yield", "true", "false", "null", "default",
}

# A *type* keyword is still a perfectly good declaration head: `double x = 1.0;`
# is a local like any other. Only the non-type keywords (`return`, `new`,
# `case`, ...) mean "this is not a declaration". Treating every keyword as a
# rejected type silently discarded every primitive declaration in the codebase.
PRIMITIVES = {"boolean", "byte", "char", "short", "int", "long", "float", "double"}
TYPE_KEYWORDS = PRIMITIVES | {"var"}
NON_TYPE_KEYWORDS = KEYWORDS - TYPE_KEYWORDS


# ==========================================================================
# blanking -- make the text safe to regex while preserving every offset
# ==========================================================================

def blank_noncode(src: str) -> str:
    """Blank comments, string/char literals and text blocks to spaces.

    Length and every newline position are preserved exactly, so an offset in
    the result is the same offset in the original. This matters: the mod's UI
    code is full of text blocks, and a brace inside one would otherwise move
    the whole parse.
    """
    out = list(src)
    n = len(src)
    i = 0

    def wipe(a: int, b: int) -> None:
        for k in range(max(0, a), min(n, b)):
            if out[k] != "\n":
                out[k] = " "

    while i < n:
        c = src[i]
        two = src[i:i + 2]
        three = src[i:i + 3]

        if two == "//":
            j = src.find("\n", i)
            j = n if j == -1 else j
            wipe(i, j)
            i = j
        elif two == "/*":
            j = src.find("*/", i + 2)
            j = n if j == -1 else j + 2
            wipe(i, j)
            i = j
        elif three == '"""':
            j = src.find('"""', i + 3)
            if j == -1:
                wipe(i + 3, n)
                i = n
            else:
                wipe(i + 3, j)
                i = j + 3
        elif c == '"':
            j = i + 1
            while j < n:
                if src[j] == "\\":
                    j += 2
                    continue
                if src[j] in ('"', "\n"):
                    break
                j += 1
            wipe(i + 1, j)
            i = j + 1
        elif c == "'":
            j = i + 1
            while j < n:
                if src[j] == "\\":
                    j += 2
                    continue
                if src[j] in ("'", "\n"):
                    break
                j += 1
            wipe(i + 1, j)
            i = j + 1
        else:
            i += 1

    return "".join(out)


def line_of(src: str, offset: int) -> int:
    return src.count("\n", 0, offset) + 1


def line_text(src: str, offset: int) -> str:
    a = src.rfind("\n", 0, offset) + 1
    b = src.find("\n", offset)
    b = len(src) if b == -1 else b
    return src[a:b].strip()


# ==========================================================================
# findings
# ==========================================================================

class Finding:
    __slots__ = ("rule", "path", "line", "message", "text", "advisory")

    def __init__(self, rule, path, line, message, text="", advisory=False):
        self.rule, self.path, self.line = rule, path, line
        self.message, self.text = message, text
        self.advisory = advisory

    def as_dict(self):
        return {"rule": self.rule, "file": self.path, "line": self.line,
                "message": self.message, "source": self.text,
                "advisory": self.advisory}

    def __str__(self):
        tag = "note" if self.advisory else "PREFLIGHT"
        return "%-12s %s:%d\n%-12s %s\n%21s| %s" % (
            tag, self.path, self.line, "", self.message, "", self.text)


# ==========================================================================
# braces, scopes, method regions
# ==========================================================================

def match_brace(code: str, start: int, limit: int | None = None) -> int:
    """Index of the '}' matching code[start] == '{'; -1 if unterminated."""
    limit = len(code) if limit is None else limit
    depth = 0
    for j in range(start, limit):
        if code[j] == "{":
            depth += 1
        elif code[j] == "}":
            depth -= 1
            if depth == 0:
                return j
    return -1


def method_regions(code: str):
    """Spans of top-level method / initialiser / compact-constructor bodies.

    A method body is a '{' at brace depth exactly 2 (file -> class -> method),
    confirmed by the previous significant character being ')' or by the body
    being a static/instance initialiser.
    """
    depth = 0
    class_open = -1
    regions = []
    i = 0
    n = len(code)
    while i < n:
        ch = code[i]
        if ch == "{":
            depth += 1
            if depth == 1:
                class_open = i
            elif depth == 2 and class_open >= 0:
                k = i - 1
                while k > class_open and code[k] in " \t\r\n":
                    k -= 1
                is_method = code[k] == ")" or \
                    code[max(0, k - 7):k + 1].endswith("static{") or \
                    code[max(0, k - 7):k + 1].endswith("static {")
                if is_method:
                    close = match_brace(code, i)
                    if close > 0:
                        regions.append((i, close))
                        i = close
        elif ch == "}":
            depth -= 1
            if depth <= 0:
                class_open = -1
                depth = 0
        i += 1
    return regions


IDENT = r"[A-Za-z_$][\w$]*"
TYPE = r"[A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*(?:\s*<[^;{}()]*?>)?(?:\s*\[\s*\])*"

DECL_RE = re.compile(r"(?P<type>%s)\s+(?P<name>%s)\s*(?=(?:=|;|,|:))" % (TYPE, IDENT))
PATTERN_VAR_RE = re.compile(r"\binstanceof\s+[\w$.<>\[\],?\s]+?\s(?P<name>%s)\b" % IDENT)
FOR_VAR_RE = re.compile(r"\bfor\s*\(\s*(?:final\s+)?(?:%s)\s+(?P<name>%s)\s*[=:]"
                        % (TYPE, IDENT))
CATCH_RE = re.compile(r"\bcatch\s*\(\s*(?:final\s+)?%s\s+(?P<name>%s)\s*\)"
                      % (TYPE, IDENT))
LAMBDA_PARAM_RE = re.compile(r"(?:\((?P<multi>[^()]*)\)|(?P<single>%s))\s*->" % IDENT)

ASSIGN_OP = r"=(?!=)|\+=|-=|\*=|/=|%=|&=|\|=|\^=|<<=|>>=|>>>=|\+\+|--"
SIMPLE_ASSIGN_RE = re.compile(r"(?P<name>%s)\s*(?:%s)" % (IDENT, ASSIGN_OP))


def walk_decls(code: str, start: int, end: int):
    """Yield (name, offset, conflict_offset_or_None) for each local declared.

    Block scoping, per the Java rules that actually bite here:

      * a plain local lives in its enclosing block;
      * a `catch (T t)` parameter lives only in its catch block;
      * a `for (int i = 0; ...)` variable lives only in its loop;
      * an `x instanceof T t` pattern variable lives in the guarded block.

    The last three are *deferred*: they belong to the block that follows them,
    not to the block they are written in. Declaring them in the enclosing frame
    is what made seventeen entirely legal `catch (Throwable t)` clauses inside
    one method read as seventeen duplicates.
    """
    frames = [{}]
    pending: list[tuple[str, int]] = []
    paren = 0
    i = start
    while i < end:
        ch = code[i]

        if ch == "(":
            paren += 1
            i += 1
            continue
        if ch == ")":
            paren = max(0, paren - 1)
            i += 1
            continue
        if ch == "{":
            frames.append({})
            for name, off in pending:
                frames[-1][name] = off
            pending = []
            i += 1
            continue
        if ch == "}":
            if len(frames) > 1:
                frames.pop()
            i += 1
            continue
        if ch == ";" and paren == 0:
            pending = []          # a brace-less loop/if body owns no block
            i += 1
            continue

        # Only ever match at a token boundary. Without this the walker steps
        # one character into a keyword and reads the remainder as a type:
        # `return out;` matched DECL_RE as type `eturn`, name `out`, which is
        # not a keyword, and so declared a variable that does not exist. That
        # was the last surviving false positive on fixtures/Clean.java.
        prev = code[i - 1] if i > 0 else " "
        if prev.isalnum() or prev in "_$":
            i += 1
            continue

        # deferred headers first, consuming their whole paren group so the
        # binding inside `for (int i = ...)` is never read as a plain local
        m = FOR_VAR_RE.match(code, i) or CATCH_RE.match(code, i)
        if m:
            name = m.group("name")
            off = m.start("name")
            conflict = None
            for fr in frames:
                if name in fr:
                    conflict = fr[name]
                    break
            pending.append((name, off))
            yield name, off, conflict
            j = code.find("(", i)
            depth = 0
            while j < end:
                if code[j] == "(":
                    depth += 1
                elif code[j] == ")":
                    depth -= 1
                    if depth == 0:
                        break
                j += 1
            i = j + 1
            continue

        m = PATTERN_VAR_RE.match(code, i)
        if m:
            name = m.group("name")
            off = m.start("name")
            conflict = None
            for fr in frames:
                if name in fr:
                    conflict = fr[name]
                    break
            pending.append((name, off))
            yield name, off, conflict
            i = m.end()
            continue

        m = DECL_RE.match(code, i)
        if m and m.group("type") not in NON_TYPE_KEYWORDS:
            name = m.group("name")
            off = m.start("name")
            conflict = None
            for fr in frames:
                if name in fr:
                    conflict = fr[name]
                    break
            frames[-1][name] = off
            yield name, off, conflict
            i = m.end()
            continue

        i += 1


def collect_decls(code: str, start: int, end: int):
    """name -> {'offset', 'assigned'} for a method region, params included."""
    decls: dict[str, dict] = {}

    p = start - 1
    while p >= 0 and code[p] != "(":
        p -= 1
    if p >= 0:
        close = code.find(")", p)
        if close != -1 and close < end:
            for m in re.finditer(r"(?:^|,)\s*(?:final\s+)?%s\s+(%s)\s*(?:,|$)"
                                 % (TYPE, IDENT), code[p + 1:close]):
                decls[m.group(1)] = {"offset": p + 1 + m.start(1), "assigned": False}

    for name, off, _conflict in walk_decls(code, start, end):
        decls.setdefault(name, {"offset": off, "assigned": False})

    for m in SIMPLE_ASSIGN_RE.finditer(code, start, end):
        name = m.group("name")
        if name not in decls:
            continue
        q = m.start("name") - 1
        while q >= start and code[q] in " \t\r\n":
            q -= 1
        if q >= start and (code[q].isalnum() or code[q] in "_$>]."):
            continue          # "Type name =" declaration, or "obj.name =" field
        decls[name]["assigned"] = True
    return decls


def lambda_spans(code: str, start: int, end: int):
    """(lo, hi) of each lambda body inside the region."""
    i = start
    while i < end - 1:
        if code[i] == "-" and code[i + 1] == ">":
            j = i + 2
            while j < end and code[j] in " \t\r\n":
                j += 1
            if j < end and code[j] == "{":
                close = match_brace(code, j, end)
                if close < 0:
                    return
                yield (j, close + 1)
                i = close + 1
                continue
            paren = brace = brack = 0
            k = j
            while k < end:
                c = code[k]
                if c == "(":
                    paren += 1
                elif c == ")":
                    if paren == 0:
                        break
                    paren -= 1
                elif c == "{":
                    brace += 1
                elif c == "}":
                    if brace == 0:
                        break
                    brace -= 1
                elif c == "[":
                    brack += 1
                elif c == "]":
                    brack -= 1
                elif not (paren or brace or brack) and c in ",;":
                    break
                k += 1
            yield (j, k)
            i = k
            continue
        i += 1


# ==========================================================================
# checks
# ==========================================================================

def check_balance(src, code, path):
    """Unbalanced {} () [] -- comments and literals already blanked."""
    stack = []
    pairs = {")": "(", "]": "[", "}": "{"}
    for i, ch in enumerate(code):
        if ch in "{[(":
            stack.append((ch, i))
        elif ch in ")]}":
            if not stack:
                return [Finding("balance", path, line_of(src, i),
                                "stray '%s' -- nothing is open here" % ch,
                                line_text(src, i))]
            if stack[-1][0] != pairs[ch]:
                return [Finding("balance", path, line_of(src, i),
                                "'%s' closes '%s' opened on line %d"
                                % (ch, stack[-1][0],
                                   line_of(src, stack[-1][1])),
                                line_text(src, i))]
            stack.pop()
    if stack:
        ch, i = stack[-1]
        return [Finding("balance", path, line_of(src, i),
                        "unclosed '%s' -- never closed before end of file" % ch,
                        line_text(src, i))]
    return []


def check_lambda_capture(src, code, path):
    """A lambda reads a local that is assigned more than once.

    That is a compile error: "local variables referenced from a lambda
    expression must be final or effectively final". It is the most recurrent
    non-symbol error in this repo's build history -- 17 occurrences across
    McsmOrbitalPlanets and McsmAuroraBorealis alone.

    Only locals declared OUTSIDE the lambda body count. A variable declared
    inside the lambda is that lambda's own local and cannot be captured; this
    is what produced a false positive on McsmVolumetricCloudMesh's `gx`/`gz`
    loop counters, which live inside the submitted geometry lambda.
    """
    findings = []
    for (s, e) in method_regions(code):
        decls = collect_decls(code, s, e)
        if not decls:
            continue
        for (lo, hi) in lambda_spans(code, s, e):
            reported = set()
            body = code[lo:hi]
            for m in re.finditer(IDENT, body):
                name = m.group(0)
                if name in reported or name in KEYWORDS:
                    continue
                info = decls.get(name)
                if not info or not info["assigned"]:
                    continue
                if lo <= info["offset"] < hi:
                    continue                       # declared inside -- not a capture
                reported.add(name)
                off = lo + m.start(0)
                findings.append(Finding(
                    "lambda-capture", path, line_of(src, off),
                    "'%s' (declared line %d) is assigned more than once, so a "
                    "lambda may not capture it -- copy it to a final local first"
                    % (name, line_of(src, info["offset"])),
                    line_text(src, off)))
    return findings


def check_dup_local(src, code, path):
    """Two locals with the same name live at once in one method.

    Scope-aware, so sibling blocks and per-clause `catch (T t)` parameters are
    correctly silent. Catches the plain double declaration
    (McsmCoreEngineController: "variable y0 is already defined in method
    cubeFace(...)") and a pattern variable shadowing a live local
    (McsmMassg.flyingThings).
    """
    findings = []
    for (s, e) in method_regions(code):
        for name, off, conflict in walk_decls(code, s, e):
            if conflict is None:
                continue
            findings.append(Finding(
                "dup-local", path, line_of(src, off),
                "'%s' is already declared on line %d and is still in scope "
                "here" % (name, line_of(src, conflict)),
                line_text(src, off)))
    return findings


CTOR_LOOKALIKE_RE = re.compile(
    r"\b(?P<type>%s)\s+(?P<var>%s)\s*=\s*(?P<a>%s)\s*,\s*(?P<b>%s)\s*,\s*(?P<c>%s)\s*;"
    % (TYPE, IDENT, IDENT, IDENT, IDENT))


def check_multideclarator(src, code, path):
    """`Vec3 a = x0, y0, z0;` -- a constructor call that is not one.

    A real logic bug, not a style note. It declares `a = x0` and then
    re-declares `y0` and `z0`, which is how javac came to report "variable y0
    is already defined in method cubeFace(...)". The author meant
    `new Vec3(x0, y0, z0)`, and because the declaration errors mask it, the
    object that would reach the renderer is a copy of `x0` -- silently wrong
    even once the errors are silenced.
    """
    findings = []
    for m in CTOR_LOOKALIKE_RE.finditer(code):
        off = m.start()
        findings.append(Finding(
            "multidecl", path, line_of(src, off),
            "declarator takes 3 comma-separated initialisers -- did you mean "
            "'new %s(%s, %s, %s)'?" % (m.group("type").strip(), m.group("a"),
                                       m.group("b"), m.group("c")),
            line_text(src, off)))
    return findings


NUM_RE = re.compile(
    r"(?<![\w.])(?P<num>\d+\.\d*(?:[eE][+-]?\d+)?"
    r"|\.\d+(?:[eE][+-]?\d+)?"
    r"|\d+(?:[eE][+-]?\d+)?)(?P<suf>[fFdD]?)(?![\w.])")

FLOAT_DECL_RE = re.compile(r"\bfloat\s+(?P<name>%s)\s*=\s*(?P<expr>[^;]+);" % IDENT)
CALL_OR_IDENT_RE = re.compile(r"\b[A-Za-z_$][\w$]*")


def double_literals(expr: str):
    """Double-typed literals in expr. Ints and floats are excluded.

    The suffix decides first. `0.0F` is a *float* literal even though it has a
    dot, and `0` is an *int* even though it has no suffix -- writing the suffix
    test as `suf in "dD"` looked right and was not, because the empty string is
    a substring of everything, so every integer literal was read as a double
    and 300 innocent lines were reported.
    """
    out = []
    for m in NUM_RE.finditer(expr):
        num, suf = m.group("num"), m.group("suf")
        if suf in ("f", "F"):
            continue
        if suf in ("d", "D"):
            out.append(m)
            continue
        if "." in num or "e" in num.lower():
            out.append(m)
    return out


def check_lossy_float(src, code, path):
    """`float x = <non-constant expression containing a double literal>;`

    Java narrows double to float implicitly only for *constant* expressions.
    Once an identifier or a call joins in, the value is a runtime double and
    the assignment is a compile error -- "possible lossy conversion from double
    to float". That is the shape that failed eight times in
    McsmInfiniteVoidLayers:

        float hue = (i * 17 + layerIndex * 13 + time * 0.01) % 360 / 360.0F;

    where `time * 0.01` promotes the whole expression to double. Fix by
    suffixing the literals (`0.01F`) or casting the expression.

    Deliberately NOT reported:
      * `float x = 1.5;`                  -- constant expression, legal
      * `float x = Mth.sin(t * 1.1F);`    -- no double literal present
      * `float x = (float) someDouble;`   -- explicit cast

    Known limitation: a float assigned a *double-valued variable* with no
    literal present is not caught, because that needs type inference.
    """
    findings = []
    for m in FLOAT_DECL_RE.finditer(code):
        expr = m.group("expr")
        if not double_literals(expr):
            continue
        if not CALL_OR_IDENT_RE.search(NUM_RE.sub(" ", expr)):
            continue
        if re.search(r"\(\s*float\s*\)", expr):
            continue
        off = m.start()
        findings.append(Finding(
            "lossy-float", path, line_of(src, off),
            "double expression assigned to float '%s' with no cast -- add 'F' "
            "to the literals or cast the whole expression" % m.group("name"),
            line_text(src, off)))
    return findings


IMPORT_RE = re.compile(r"^[ \t]*import\s+(?:static\s+)?(?P<fq>[\w$.]+)\s*;", re.M)


def check_unused_import(src, code, path):
    """Imports never referenced anywhere in the file.

    Earns its place twice: a stale import is a leftover from a refactor, and it
    is how a file ends up naming a class that no longer lives at that path --
    which the compiler then reports as "cannot find symbol" far from the cause.
    """
    findings = []
    for m in IMPORT_RE.finditer(code):
        fq = m.group("fq")
        simple = fq.rsplit(".", 1)[-1]
        rest = code[:m.start()] + code[m.end():]
        if re.search(r"\b%s\b" % re.escape(simple), rest):
            continue
        off = m.start() + src[m.start():].index("import")
        findings.append(Finding(
            "unused-import", path, line_of(src, off),
            "import '%s' is never used" % fq, line_text(src, off)))
    return findings


# --------------------------------------------------------------------------
# api-drift -- ADVISORY ONLY. See the caveat below; it must not fail a build.
# --------------------------------------------------------------------------

def load_index(paths):
    """class fq name -> {'methods': set, 'fields': set, 'source': path}."""
    index = {}
    for p in paths:
        try:
            with open(p, encoding="utf-8", errors="replace") as fh:
                text = fh.read()
        except OSError:
            continue
        cur = None
        for line in text.splitlines():
            if line.startswith("====="):
                cur = line[5:].strip()
                index.setdefault(cur, {"methods": set(), "fields": set(),
                                       "source": p})
                continue
            if cur is None or not line.startswith(" "):
                continue
            body = line.strip().rstrip(";")
            mm = re.match(r"^[\w$.<>,?\[\]\s]+?\s(%s)\s*\((.*)\)$" % IDENT, body)
            if mm:
                index[cur]["methods"].add(mm.group(1))
                continue
            mm = re.match(r"^[\w$.<>,?\[\]\s]+?\s(%s)$" % IDENT, body)
            if mm:
                index[cur]["fields"].add(mm.group(1))
    return index


def check_api_drift(src, code, path, index):
    """ADVISORY: a member accessed on a class whose dump does not list it.

    THIS CHECK MUST NEVER FAIL A BUILD. Every dump in ci-out/ comes from
    `javap -p`, which prints *declared* members only. Inherited members are
    therefore invisible, so PathfinderMob.createMobAttributes() looks absent
    even though it is inherited from LivingEntity. The signal is still useful
    to a human -- "confirm this symbol before pushing" -- but it is raised as a
    note, and the reader is told the reason.
    """
    if not index:
        return []
    by_simple = {}
    for fq in index:
        by_simple.setdefault(fq.rsplit(".", 1)[-1], []).append(fq)

    findings, seen = [], set()
    for m in re.finditer(r"\b([A-Z][\w$]*)\s*\.\s*([a-z_$][\w$]*)\s*\(", code):
        cls, member = m.group(1), m.group(2)
        cands = by_simple.get(cls)
        if not cands or len(cands) != 1:
            continue
        info = index[cands[0]]
        if member in info["methods"] or member in info["fields"]:
            continue
        if (cls, member) in seen:
            continue
        seen.add((cls, member))
        off = m.start()
        findings.append(Finding(
            "api-drift", path, line_of(src, off),
            "'%s.%s' is not declared in the dump for %s -- it may be inherited "
            "(fine) or renamed (a javac error). Verify before pushing."
            % (cls, member, cands[0]),
            line_text(src, off), advisory=True))
    return findings


CHECKS = ("balance", "lambda-capture", "dup-local", "multidecl",
          "lossy-float", "unused-import", "api-drift")

# Which rules may stop a build.
#
# BLOCKING rules are the ones whose finding is a guaranteed javac error. If one
# of them fires, javac would have failed, so failing early costs nothing and
# saves a runner.
#
# ADVISORY rules are real but not necessarily fatal. `unused-import` is safe to
# defer (the code still compiles); `api-drift` must be deferred, because the
# javap oracle cannot see inherited members. Making either blocking would put a
# gate in front of the build that fails on things that are not errors -- and
# the first response to that is to delete the gate.
BLOCKING_RULES = ("balance", "lambda-capture", "dup-local", "multidecl",
                  "lossy-float")
ADVISORY_RULES = tuple(c for c in CHECKS if c not in BLOCKING_RULES)


# ==========================================================================
# driver
# ==========================================================================

def analyse(path, index, only=None, allow=()):
    with open(path, encoding="utf-8", errors="replace") as fh:
        src = fh.read()
    code = blank_noncode(src)
    out = []
    simple = (lambda fn: only is None or fn.__name__ == "check_" + only.replace("-", "_"))
    for fn in (check_balance, check_lambda_capture, check_dup_local,
               check_multideclarator, check_lossy_float, check_unused_import):
        if simple(fn):
            out.extend(fn(src, code, path))
    if only is None or only == "api-drift":
        out.extend(check_api_drift(src, code, path, index))
    if allow:
        out = [f for f in out if f.rule not in allow]
    return out


def gather_roots(root="."):
    files = []
    compiled = os.path.join(root, COMPILED_ROOT)
    for dirpath, _dn, filenames in os.walk(compiled):
        for name in sorted(filenames):
            if not name.endswith(".java"):
                continue
            rel = os.path.relpath(os.path.join(dirpath, name), root)
            if any(x in "/" + rel for x in EXCLUDE_PATH) or name in EXCLUDE_NAMES:
                continue
            files.append(rel)
    model = os.path.join(root, MODEL_ROOT)
    if os.path.isdir(model):
        for name in sorted(os.listdir(model)):
            if MODEL_GLOB.match(name):
                files.append(os.path.relpath(os.path.join(model, name), root))
    return files


def find_dumps(root="."):
    out = []
    for base in ("out", "ci-out"):
        d = os.path.join(root, base)
        if not os.path.isdir(d):
            continue
        for dirpath, _dn, filenames in os.walk(d):
            for name in filenames:
                if name.endswith("vanilla-api.txt"):
                    out.append(os.path.join(dirpath, name))
    return sorted(out)


def main(argv=None):
    ap = argparse.ArgumentParser(
        description="Static Java preflight for the Devouring Storms build.")
    ap.add_argument("files", nargs="*", help="java files (default with --roots)")
    ap.add_argument("--roots", action="store_true",
                    help="scan the roots ci/build.sh actually compiles")
    ap.add_argument("--root", default=".", help="repository root")
    ap.add_argument("--only", default=None, choices=list(CHECKS))
    ap.add_argument("--allow", action="append", default=[],
                    help="suppress a rule (repeatable)")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--quiet", action="store_true",
                    help="summary only, no per-finding detail")
    ap.add_argument("--strict", action="store_true",
                    help="advisory notes fail the gate too")
    args = ap.parse_args(argv)

    files = args.files or (gather_roots(args.root) if args.roots else [])
    if not files:
        ap.error("no input: pass .java files or --roots")

    want_api = (args.only in (None, "api-drift")) and "api-drift" not in args.allow
    dumps = find_dumps(args.root) if want_api else []
    index = load_index(dumps) if want_api else {}

    findings = []
    for f in files:
        if os.path.exists(f):
            findings.extend(analyse(f, index, args.only, tuple(args.allow)))

    if args.strict:
        hard = list(findings)
    else:
        hard = [f for f in findings
                if f.rule in BLOCKING_RULES and not f.advisory]
    notes = [f for f in findings if f not in hard]

    if args.json:
        print(json.dumps([f.as_dict() for f in findings], indent=2))
    else:
        if not args.quiet:
            for f in hard:
                print(f)
            for f in notes:
                print(f)
        print()
        print("[preflight] %d file(s) scanned -- %d blocking, %d advisory"
              % (len(files), len(hard), len(notes)))
        if want_api:
            if index:
                print("[preflight] symbol oracle: %d class(es) from %d javap dump(s)"
                      % (len(index), len(dumps)))
            else:
                print("[preflight] symbol oracle: none -- no vanilla-api.txt found, "
                      "symbol notes skipped")
        counts = {}
        for f in hard:
            counts[f.rule] = counts.get(f.rule, 0) + 1
        notes_by_rule = {}
        for f in notes:
            notes_by_rule[f.rule] = notes_by_rule.get(f.rule, 0) + 1
        for rule in BLOCKING_RULES:
            if counts.get(rule):
                print("[preflight]   BLOCK  %-16s %d" % (rule, counts[rule]))
        for rule in ADVISORY_RULES:
            if notes_by_rule.get(rule):
                print("[preflight]   note   %-16s %d" % (rule, notes_by_rule[rule]))

    return 1 if hard else 0


if __name__ == "__main__":
    sys.exit(main())
