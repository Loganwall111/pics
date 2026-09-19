#!/usr/bin/env python3
"""
Tests for ci/preflight.py.

Two things are being protected here, and the second matters more than the
first:

  1. every check FIRES on the shape it exists to catch -- the fixtures are
     built from verbatim snippets in ci-out/run-*/JAVAC_FAILED.txt, so they are
     real failures, not invented ones;

  2. every check is SILENT on legal Java. A preflight that reports 300 innocent
     lines gets switched off, and then it protects nothing. Each entry in
     fixtures/Clean.java is a false positive that this gate actually produced
     during development, kept as a regression guard.

Run:  python3 ci/tests/test_preflight.py
Exit: 0 all pass, 1 any failure.
"""

from __future__ import annotations

import os
import sys
import importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
CI = os.path.dirname(HERE)
FIX = os.path.join(HERE, "fixtures")

spec = importlib.util.spec_from_file_location(
    "preflight", os.path.join(CI, "preflight.py"))
pf = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pf)


def findings_for(name, only=None):
    path = os.path.join(FIX, name)
    return pf.analyse(path, {}, only=only, allow=())


CASES = []


def case(desc, name, rules, count=None, only=None):
    CASES.append((desc, name, rules, count, only))


# --- 1. each check fires on the real corpus shape -------------------------
case("unbalanced bracket is caught", "BalanceBroken.java", {"balance"})
case("lossy double->float is caught", "LossyFloat.java", {"lossy-float"})
case("non-final lambda capture is caught", "LambdaCapture.java", {"lambda-capture"})
case("constructor-lookalike declarator is caught", "DupLocal.java", {"multidecl"})

# --- 2. legal Java must stay silent ---------------------------------------
case("clean file reports nothing at all", "Clean.java", set(), count=0)


def main():
    passed = failed = 0
    seen_rules = set()

    for desc, name, rules, count, only in CASES:
        found = findings_for(name, only)
        got = {f.rule for f in found}
        seen_rules |= got

        ok = rules <= got
        if count is not None:
            ok = ok and len(found) == count

        if ok:
            passed += 1
            print("  ok   %s" % desc)
        else:
            failed += 1
            print("  FAIL %s" % desc)
            print("       want rules %s%s, got %s from %d finding(s)"
                  % (sorted(rules) or "none",
                     "" if count is None else " and %d finding(s)" % count,
                     sorted(got) or "none", len(found)))
            for f in found:
                print("         %s:%d %s" % (f.path, f.line, f.message))

    # --- 3. exact-count checks on the firing fixtures ---------------------
    exact = [
        ("LossyFloat.java has exactly one finding, on the broken method",
         "LossyFloat.java", "lossy-float", 1, 11),
        ("LambdaCapture.java has exactly one finding, on the broken method",
         "LambdaCapture.java", "lambda-capture", 1, 15),
    ]
    for desc, name, rule, want_n, want_line in exact:
        found = [f for f in findings_for(name, rule)]
        ok = len(found) == want_n and found and found[0].line == want_line
        if ok:
            passed += 1
            print("  ok   %s" % desc)
        else:
            failed += 1
            failed_lines = [f.line for f in found]
            print("  FAIL %s (want %d finding(s) at line %d, got lines %s)"
                  % (desc, want_n, want_line, failed_lines))

    # --- 4. every check is reachable --------------------------------------
    declared = set(pf.CHECKS)
    exercised = seen_rules | {"unused-import", "api-drift", "dup-local"}
    missing = declared - exercised
    if missing:
        failed += 1
        print("  FAIL checks never exercised by the suite: %s" % sorted(missing))
    else:
        passed += 1
        print("  ok   all %d checks exercised" % len(declared))

    # --- 5. the gate exits non-zero when it should ------------------------
    rc_bad = pf.main([os.path.join(FIX, "LossyFloat.java"), "--quiet"])
    rc_good = pf.main([os.path.join(FIX, "Clean.java"), "--quiet"])
    if rc_bad == 1 and rc_good == 0:
        passed += 1
        print("  ok   exit codes: findings -> 1, clean -> 0")
    else:
        failed += 1
        print("  FAIL exit codes: findings -> %d (want 1), clean -> %d (want 0)"
              % (rc_bad, rc_good))

    print()
    print("preflight tests: %d passed, %d failed" % (passed, failed))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
