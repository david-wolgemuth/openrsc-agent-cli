package scripting.idlescript;

import controller.BotController;
import controller.Controller;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Minimal loopback-only server for the bridge protocol.
 *
 * <p>It handles one client at a time and echoes one newline-delimited frame before closing that
 * client connection.
 */
public final class ScriptServer implements Runnable {
  private static final AtomicLong NEXT_REQUEST_ID = new AtomicLong(1);
  private final Controller controller;
  private final BotController botController;
  private final MessageBuffer messageBuffer;
  private final int port;
  private ServerSocket serverSocket;

  public ScriptServer(
      Controller controller, BotController botController, MessageBuffer messageBuffer, int port)
      throws IOException {
    this.controller = controller;
    this.botController = botController;
    this.messageBuffer = messageBuffer;
    this.port = port;
    this.serverSocket = new ServerSocket(port, 1, InetAddress.getByName("127.0.0.1"));
  }

  public void start() {
    Thread thread = new Thread(this, "idlersc-bridge-server");
    thread.setDaemon(true);
    thread.start();
  }

  public void close() {
    try {
      serverSocket.close();
    } catch (IOException exception) {
      controller.log("idlersc-bridge: server close failed: " + exception.getMessage(), "red");
    }
  }

  @Override
  public void run() {
    try {
      while (!serverSocket.isClosed()) {
        handleConnection(serverSocket.accept());
      }
    } catch (IOException exception) {
      if (!serverSocket.isClosed()) {
        controller.log("idlersc-bridge: accept failed: " + exception.getMessage(), "red");
      }
    }
  }

  private void handleConnection(Socket client) {
    try (Socket socket = client;
        BufferedReader reader =
            new BufferedReader(
                new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
        PrintWriter writer = new PrintWriter(socket.getOutputStream(), true)) {
      String frame = reader.readLine();
      if (frame != null) {
        try {
          Protocol.Request request = Protocol.parse(frame);
          if ("run".equals(request.getOperation())) {
            BridgeTrace trace = new BridgeTrace(controller, NEXT_REQUEST_ID.getAndIncrement());
            trace.stage("request_received");
            ScriptWorker worker =
                new ScriptWorker(
                    controller, botController, messageBuffer, request.getSource(), trace);
            worker.start();
            worker.join();
            String response;
            if (worker.getError() != null) response = Protocol.error(worker.getError());
            else response = Protocol.success(worker.getResult());
            trace.stage("response_serialized");
            trace.stage("response_write_started");
            writer.println(response);
            trace.stage("response_write_finished");
          } else {
            writer.println(Protocol.error(new IllegalArgumentException("unknown operation")));
          }
        } catch (Exception exception) {
          writer.println(Protocol.error(exception));
        }
      }
    } catch (IOException exception) {
      controller.log("idlersc-bridge: client failed: " + exception.getMessage(), "red");
    }
  }
}
