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
  private MessageBuffer messageBuffer;
  private boolean started;

  @Override
  public void questMessageInterrupt(String message) {
    record("QUEST", null, message);
  }

  @Override
  public void chatMessageInterrupt(String message) {
    record("CHAT", null, message);
  }

  @Override
  public void serverMessageInterrupt(String message) {
    record("GAME", null, message);
  }

  @Override
  public void privateMessageReceivedInterrupt(String sender, String message) {
    record("PRIVATE_RECEIVE", sender, message);
  }

  @Override
  public void tradeMessageInterrupt(String sender) {
    record("TRADE", sender, null);
  }

  private void record(String type, String sender, String text) {
    if (messageBuffer != null) messageBuffer.add(type, sender, text);
  }

  @Override
  public int start(String[] parameters) {
    if (!started) {
      started = true;
      try {
        messageBuffer = new MessageBuffer();
        botController = new BotController(controller);
        server = new ScriptServer(controller, botController, messageBuffer, DEFAULT_PORT);
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
    if (messageBuffer != null) messageBuffer.close();
  }
}
