package scripting.idlescript;

import controller.BotController;
import controller.Controller;
import javax.script.ScriptEngine;
import javax.script.ScriptEngineManager;

/** Executes one trusted JavaScript source string in an isolated Nashorn engine. */
public final class ScriptWorker extends Thread {
  private final Controller controller;
  private final BotController botController;
  private final String source;
  private Object result;
  private Throwable error;

  public ScriptWorker(Controller controller, BotController botController, String source) {
    super("idlersc-bridge-script-worker");
    this.controller = controller;
    this.botController = botController;
    this.source = source;
  }

  @Override
  public void run() {
    try {
      ScriptEngine engine = new ScriptEngineManager().getEngineByName("nashorn");
      if (engine == null)
        throw new IllegalStateException("Nashorn JavaScript engine is unavailable");
      engine.put("controller", controller);
      engine.put("botController", botController);
      engine.put("console", new ScriptConsole(controller));
      result = engine.eval(source);
    } catch (Throwable exception) {
      error = exception;
    }
  }

  public Object getResult() {
    return result;
  }

  public Throwable getError() {
    return error;
  }

  /** Small explicit logging surface for scripts. */
  public static final class ScriptConsole {
    private final Controller controller;

    public ScriptConsole(Controller controller) {
      this.controller = controller;
    }

    public void log(Object value) {
      controller.log(String.valueOf(value), "yel");
    }
  }
}
