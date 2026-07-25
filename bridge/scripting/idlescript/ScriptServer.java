package scripting.idlescript;

import controller.Controller;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;

/**
 * Minimal loopback-only server for the bridge protocol.
 *
 * <p>It handles one client at a time and echoes one newline-delimited frame before closing that
 * client connection.
 */
public final class ScriptServer implements Runnable {
  private final Controller controller;
  private final int port;
  private ServerSocket serverSocket;

  public ScriptServer(Controller controller, int port) throws IOException {
    this.controller = controller;
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
            ScriptWorker worker = new ScriptWorker(controller, request.getSource());
            worker.start();
            worker.join();
            if (worker.getError() != null) writer.println(Protocol.error(worker.getError()));
            else writer.println(Protocol.success(worker.getResult()));
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
