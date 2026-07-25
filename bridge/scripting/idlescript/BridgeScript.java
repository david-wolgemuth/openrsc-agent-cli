package scripting.idlescript;

import controller.BotController;

/**
 * IdleRSC entry point for the local idlersc-bridge server.
 *
 * <p>The first version only proves the server lifecycle and newline-delimited echo protocol.
 * JavaScript evaluation and Controller binding belong to later phases.
 */
public class BridgeScript extends IdleScript {
  private static final int DEFAULT_PORT = 8765;

  private ScriptServer server;
  private BotController botController;
  private boolean started;

  @Override
  public int start(String[] parameters) {
    if (!started) {
      started = true;
      try {
        botController = new BotController(controller);
        server = new ScriptServer(controller, botController, DEFAULT_PORT);
        server.start();
        Runtime.getRuntime().addShutdownHook(new Thread(this::shutdown, "idlersc-bridge-shutdown"));
        controller.log("idlersc-bridge: listening on 127.0.0.1:" + DEFAULT_PORT, "yel");
      } catch (Exception exception) {
        controller.log("idlersc-bridge: server failed: " + exception.getMessage(), "red");
      }
    }
    return 1000;
  }

  private void shutdown() {
    try {
      if (controller != null && controller.isLoggedIn()) {
        controller.setAutoLogin(false);
        controller.logout();
        controller.log("idlersc-bridge: logout requested during shutdown", "yel");
      }
    } catch (Throwable exception) {
      // Shutdown is best-effort; do not prevent the JVM from exiting.
      System.err.println("idlersc-bridge: shutdown logout failed: " + exception.getMessage());
    }
    if (server != null) server.close();
  }
}
