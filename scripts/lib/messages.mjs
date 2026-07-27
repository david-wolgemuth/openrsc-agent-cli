/* Unified incoming-message access for NPCs, players, system messages, and private messages. */

function messagesSince(cursor) {
  var events = messages.since(cursor);
  var result = [];
  for (var i = 0; i < events.size(); i += 1) {
    var event = events.get(i);
    result.push({
      sequence: Number(event.getSequence()),
      timestamp: Number(event.getTimestamp()),
      type: String(event.getType()),
      sender: event.getSender() === null ? null : String(event.getSender()),
      text: event.getText() === null ? null : String(event.getText()),
    });
  }
  return result;
}

export { messagesSince };
