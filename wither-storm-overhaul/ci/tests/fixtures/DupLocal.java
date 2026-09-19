// Fixture: "variable y0 is already defined in method cubeFace(...)" from
// McsmCoreEngineController.java:223, plus the pattern-variable variant from
// McsmMassg.java:619 ("variable beast is already defined in method flyingThings").
package fixture;

public final class DupLocal {

    static double[] broken(double x0, double y0, double z0, Object mob) {
        Vec a = x0, y0, z0;
        return new double[] { a.x };
    }

    static final class Vec {
        final double x;
        Vec(double x, double y, double z) { this.x = x; }
    }
}
