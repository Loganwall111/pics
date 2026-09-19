// Fixture from the corpus: an unbalanced delimiter, caught before it costs a
// CI round trip. The mod's own check_java_balance.py found exactly this shape
// in SeveredRope.java ("unclosed '[' opened on line 3").
package fixture;

public final class BalanceBroken {
    void go() {
        int[] xs = new int[] {
            1, 2, 3;
    }
}
