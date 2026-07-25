package scripting.idlescript;

/**
 * Minimal bridge smoke test.
 *
 * <p>This class intentionally does not start the bridge server or evaluate JavaScript. It proves
 * that source owned by this repository is compiled into IdleRSC, discovered by the native script
 * loader, instantiated, given a Controller, and entered through {@link #start(String[])}.
 */
public class BridgeHelloWorld extends IdleScript {
  private boolean announced;

  @Override
  public int start(String[] parameters) {
    if (!announced) {
      // System.out is not captured by IdleRSC's Logger. Controller.log is the supported script
      // logging path and writes to the console, the in-client log panel, and the log file.
      controller.log("idlersc-bridge: hello world", "yel");
      announced = true;
    }
    return 1000;
  }
}
