// Anti-false-positive guard. Every construct below is LEGAL Java and the gate
// must report nothing for this file. Each was a real false positive during
// development of ci/preflight.py.
package fixture;

import java.util.ArrayList;
import java.util.List;
import java.util.function.IntSupplier;

public final class Clean {

    // 1. Seventeen sibling catch clauses with the same parameter name are
    //    legal: a catch parameter is scoped to its own block. Declaring it in
    //    the enclosing frame made McsmBuiltinPackMixin.java report 17 dup-locals.
    static List<String> catches() {
        List<String> out = new ArrayList<>();
        try { out.add("a"); } catch (Throwable t) { out.add(t.getMessage()); }
        try { out.add("b"); } catch (Throwable t) { out.add(t.getMessage()); }
        try { out.add("c"); } catch (Throwable t) { out.add(t.getMessage()); }
        return out;
    }

    // 2. Pattern variables in sibling blocks do not conflict.
    //    McsmVoidLurker.java:101 and :119 are both legal.
    static double patterns(Object level, Object other) {
        double d = 0.0;
        if (level instanceof String server) {
            d += server.length();
        }
        if (other instanceof String server) {
            d += server.length();
        }
        return d;
    }

    // 3. A variable declared INSIDE the lambda is the lambda's own local and
    //    cannot be a captured local. McsmVolumetricCloudMesh.java's gx/gz
    //    loop counters live inside the submitted geometry lambda.
    static void loopInsideLambda(List<IntSupplier> sink) {
        int total = 0;
        sink.add(() -> {
            int acc = 0;
            for (int gz = 0; gz < 8; gz++) {
                acc += gz;
            }
            return acc;
        });
        for (int gz = 0; gz < 8; gz++) {
            total += gz;
        }
    }

    // 4. float assignments that are fine.
    static float floats(float t) {
        float a = 1.5f;                       // constant expression
        float b = 1.5F;                       // suffix
        float c = Mth.sin(t * 1.1F);          // float in, float out
        float d = (float) Math.sin(t);        // explicit cast
        float e = (float) (t * 0.5 + 1.0);    // explicit cast
        return a + b + c + d + e;
    }

    // 5. An int literal expression assigned to float is fine.
    static float ints(int i, int[] w) {
        float tot = w[0] + w[1] + w[2] + w[3];
        return tot + i;
    }

    static final class Mth {
        static float sin(float v) { return (float) Math.sin(v); }
    }
}
