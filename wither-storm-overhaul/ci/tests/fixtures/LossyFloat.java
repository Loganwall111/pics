// Fixture: verbatim shape from ci-out/run-704/JAVAC_FAILED.txt --
//   mcsm-extras/java/net/mcsm/extras/client/McsmInfiniteVoidLayers.java:211
//   error: incompatible types: possible lossy conversion from double to float
//          float hue = (i * 17 + layerIndex * 13 + time * 0.01) % 360 / 360.0F;
// The `time * 0.01` promotes the whole expression to double.
package fixture;

public final class LossyFloat {

    static float broken(int i, int layerIndex, double time) {
        float hue = (i * 17 + layerIndex * 13 + time * 0.01) % 360 / 360.0F;
        return hue;
    }

    static float fixedA(int i, int layerIndex, double time) {
        float hue = (i * 17 + layerIndex * 13 + time * 0.01F) % 360F / 360.0F;
        return hue;
    }

    static float fixedB(int i, int layerIndex, double time) {
        float hue = (float) ((i * 17 + layerIndex * 13 + time * 0.01) % 360 / 360.0F);
        return hue;
    }
}
