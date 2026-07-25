package scripting.idlescript;

/** Minimal newline-delimited bridge protocol for the server-skeleton phase. */
public final class Protocol {
  private Protocol() {}

  public static String echo(String frame) {
    return frame;
  }
}
