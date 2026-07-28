function eventRecord(event) {
  return {
    sequence: Number(event.getSequence()),
    timestamp: Number(event.getTimestamp()),
    type: String(event.getType()),
    sender: event.getSender() === null ? null : String(event.getSender()),
    text: event.getText() === null ? null : String(event.getText()),
  };
}

function captureEvents(cursor) {
  var result = [];
  var list = messages.since(cursor);
  for (var i = 0; i < list.size(); i += 1) result.push(eventRecord(list.get(i)));
  return { since: cursor, nextCursor: Number(messages.cursor()), events: result };
}

export { captureEvents };
