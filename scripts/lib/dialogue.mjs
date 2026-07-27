/* Structured NPC dialogue capture from the bridge callback stream. */

function messagesSince(cursor) {
  var messages = dialogue.since(cursor);
  var result = [];
  for (var i = 0; i < messages.size(); i += 1) {
    var message = messages.get(i);
    result.push({
      sequence: Number(message.getSequence()),
      timestamp: Number(message.getTimestamp()),
      type: String(message.getType()),
      sender: message.getSender() === null ? null : String(message.getSender()),
      text: message.getText() === null ? null : String(message.getText()),
    });
  }
  return result;
}

function waitForMessageContaining(text, timeoutMs, pollMs) {
  var wanted = String(text).toLowerCase();
  var cursor = Number(dialogue.cursor());
  var deadline = new Date().getTime() + (timeoutMs || 10000);
  while (new Date().getTime() < deadline) {
    var messages = messagesSince(cursor);
    for (var i = 0; i < messages.length; i += 1) {
      if (messages[i].text.toLowerCase().indexOf(wanted) !== -1) return messages[i];
    }
    controller.sleep(pollMs || 100);
  }
  return null;
}

export { messagesSince, waitForMessageContaining };
