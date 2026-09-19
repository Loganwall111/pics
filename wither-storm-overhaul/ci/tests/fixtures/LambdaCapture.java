// Fixture: "local variables referenced from a lambda expression must be final
// or effectively final" -- 17 occurrences across the corpus, e.g.
// McsmOrbitalPlanets.java:105 and McsmAuroraBorealis.java:68.
package fixture;

import java.util.function.DoubleSupplier;

public final class LambdaCapture {

    static double broken(double tint) {
        double nightAlpha = 1.0;
        if (tint > 0.5) {
            nightAlpha = 0.25;          // reassigned -> no longer effectively final
        }
        DoubleSupplier s = () -> 220 * nightAlpha;   // illegal capture
        return s.getAsDouble();
    }

    static double fixed(double tint) {
        double nightAlpha = 1.0;
        if (tint > 0.5) {
            nightAlpha = 0.25;
        }
        final double alpha = nightAlpha;             // snapshot
        DoubleSupplier s = () -> 220 * alpha;
        return s.getAsDouble();
    }
}
