package scripting.idlescript;

import controller.Controller;

/** Request-scoped lifecycle logging exposed to trusted bridge scripts. */
public final class BridgeTrace {
  private final Controller controller;
  private final long requestId;
  private final long startedAt;

  public BridgeTrace(Controller controller, long requestId) {
    this.controller = controller;
    this.requestId = requestId;
    this.startedAt = System.currentTimeMillis();
  }

  public void stage(String stage) {
    String position = "null";
    String loggedIn = "null";
    String running = "null";
    try {
      position = "{\"x\":" + controller.currentX() + ",\"y\":" + controller.currentY() + "}";
      loggedIn = String.valueOf(controller.isLoggedIn());
      running = String.valueOf(controller.isRunning());
    } catch (Throwable ignored) {
      // Lifecycle logging must never turn an operational failure into another failure.
    }
    controller.log(
        "idlersc-bridge-stage "
            + "{\"requestId\":"
            + requestId
            + ",\"stage\":\""
            + escape(stage)
            + "\",\"timestamp\":"
            + System.currentTimeMillis()
            + ",\"elapsedMs\":"
            + (System.currentTimeMillis() - startedAt)
            + ",\"position\":"
            + position
            + ",\"loggedIn\":"
            + loggedIn
            + ",\"running\":"
            + running
            + ",\"thread\":\""
            + escape(Thread.currentThread().getName())
            + "\"}",
        "yel");
  }

  public void exception(String stage, Throwable error) {
    stage(
        stage
            + " exception="
            + error.getClass().getName()
            + ":"
            + String.valueOf(error.getMessage()));
  }

  private static String escape(String value) {
    return String.valueOf(value).replace("\\", "\\\\").replace("\"", "\\\"");
  }
}
