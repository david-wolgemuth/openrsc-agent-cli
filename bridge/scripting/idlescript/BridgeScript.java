package scripting.idlescript;

/**
 * IdleRSC entry point for the local idlersc-bridge server.
 *
 * <p>The first version only proves the server lifecycle and newline-delimited echo protocol.
 * JavaScript evaluation and Controller binding belong to later phases.
 */
public class BridgeScript extends IdleScript {
  private static final int DEFAULT_PORT = 8765;

  private ScriptServer server;
  private boolean started;

  @Override
  public int start(String[] parameters) {
    if (!started) {
      started = true;
      try {
        server = new ScriptServer(controller, DEFAULT_PORT);
        server.start();
        controller.log("idlersc-bridge: listening on 127.0.0.1:" + DEFAULT_PORT, "yel");
      } catch (Exception exception) {
        controller.log("idlersc-bridge: server failed: " + exception.getMessage(), "red");
      }
    }
    return 1000;
  }
}
