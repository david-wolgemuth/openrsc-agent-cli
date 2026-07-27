package scripting.idlescript;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

/**
 * Unified capture of incoming IdleRSC messages, with a bounded API buffer and JSONL persistence.
 */
public final class MessageBuffer {
  private static final int MAX_MESSAGES = 512;

  private final List<MessageEvent> messages = new ArrayList<>();
  private final BufferedWriter writer;
  private final String logPath;
  private long nextSequence = 1;

  public MessageBuffer() throws IOException {
    File directory = new File("logs");
    if (!directory.exists() && !directory.mkdirs()) {
      throw new IOException("could not create logs directory");
    }
    String timestamp = new SimpleDateFormat("yyyy-MM-dd_HH-mm-ss-SSS").format(new Date());
    File file = new File(directory, "idlersc-bridge-messages-" + timestamp + ".jsonl");
    logPath = file.getPath();
    writer = new BufferedWriter(new FileWriter(file, true));
  }

  public synchronized void add(String type, String sender, String text) {
    MessageEvent event =
        new MessageEvent(nextSequence++, System.currentTimeMillis(), type, sender, text);
    messages.add(event);
    if (messages.size() > MAX_MESSAGES) messages.remove(0);
    try {
      writer.write(event.toJson());
      writer.newLine();
      writer.flush();
    } catch (IOException exception) {
      // Keep the live in-memory stream usable if persistence temporarily fails.
      System.err.println("idlersc-bridge: message log write failed: " + exception.getMessage());
    }
  }

  public synchronized long cursor() {
    return nextSequence - 1;
  }

  public synchronized List<MessageEvent> since(long cursor) {
    List<MessageEvent> result = new ArrayList<>();
    for (MessageEvent event : messages) {
      if (event.getSequence() > cursor) result.add(event);
    }
    return result;
  }

  public synchronized String getLogPath() {
    return logPath;
  }

  public synchronized void close() {
    try {
      writer.close();
    } catch (IOException exception) {
      System.err.println("idlersc-bridge: message log close failed: " + exception.getMessage());
    }
  }

  public static final class MessageEvent {
    private final long sequence;
    private final long timestamp;
    private final String type;
    private final String sender;
    private final String text;

    private MessageEvent(long sequence, long timestamp, String type, String sender, String text) {
      this.sequence = sequence;
      this.timestamp = timestamp;
      this.type = type;
      this.sender = sender;
      this.text = text;
    }

    public long getSequence() {
      return sequence;
    }

    public long getTimestamp() {
      return timestamp;
    }

    public String getType() {
      return type;
    }

    public String getSender() {
      return sender;
    }

    public String getText() {
      return text;
    }

    private String toJson() {
      return "{\"sequence\":"
          + sequence
          + ",\"timestamp\":"
          + timestamp
          + ",\"type\":\""
          + escape(type)
          + "\",\"sender\":"
          + nullable(sender)
          + ",\"text\":"
          + nullable(text)
          + "}";
    }

    private static String nullable(String value) {
      return value == null ? "null" : "\"" + escape(value) + "\"";
    }

    private static String escape(String value) {
      if (value == null) return "";
      return value
          .replace("\\", "\\\\")
          .replace("\"", "\\\"")
          .replace("\r", "\\r")
          .replace("\n", "\\n")
          .replace("\t", "\\t");
    }
  }
}
