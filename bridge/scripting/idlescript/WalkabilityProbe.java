package scripting.idlescript;

import controller.Controller;
import java.util.ArrayList;
import java.util.List;

/** Read-only access to the live client's collision/path reachability checks. */
public final class WalkabilityProbe {
  private final Controller controller;

  public WalkabilityProbe(Controller controller) {
    this.controller = controller;
  }

  /** Whether the live client can reach a tile from the current player position. */
  public boolean isReachable(int x, int y, boolean includeTileEdges) {
    return controller.isReachable(x, y, includeTileEdges);
  }

  /** Compact probe record suitable for JSON.stringify in Nashorn. */
  public Probe probe(int x, int y, boolean includeTileEdges) {
    return new Probe(x, y, controller.isReachable(x, y, includeTileEdges));
  }

  /** Probe a small square around the player; radius is capped to avoid expensive scans. */
  public List<Probe> around(int radius, boolean includeTileEdges) {
    int boundedRadius = Math.max(0, Math.min(radius, 3));
    int x = controller.currentX();
    int y = controller.currentY();
    List<Probe> result = new ArrayList<>();
    for (int dy = -boundedRadius; dy <= boundedRadius; dy++) {
      for (int dx = -boundedRadius; dx <= boundedRadius; dx++) {
        result.add(probe(x + dx, y + dy, includeTileEdges));
      }
    }
    return result;
  }

  public static final class Probe {
    private final int x;
    private final int y;
    private final boolean reachable;

    private Probe(int x, int y, boolean reachable) {
      this.x = x;
      this.y = y;
      this.reachable = reachable;
    }

    public int getX() {
      return x;
    }

    public int getY() {
      return y;
    }

    public boolean isReachable() {
      return reachable;
    }
  }
}
