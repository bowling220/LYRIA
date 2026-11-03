/* Atomic workspace creation, with bounded transport fallback and durable retry IDs. */
(() => {
  const API = window.LyriaDataAPI;
  const attempts = new Map();
  const current = () => window.firebaseConfig.getAuth().currentUser;
  async function create(name) {
    const user = current();
    name = String(name || "").trim();
    if (!user) throw Error("Sign in before creating a conversation.");
    if (!name || name.length > 48)
      throw Error("Choose a name between 1 and 48 characters.");
    const key = "lyria:channel-create:" + user.uid;
    let pending = attempts.get(user.uid);
    try {
      if (!pending) pending = JSON.parse(sessionStorage.getItem(key));
    } catch {}
    if (pending?.name !== name || !/^[a-f0-9-]{36}$/.test(pending?.id || ""))
      pending = { id: crypto.randomUUID(), name };
    attempts.set(user.uid, pending);
    try {
      sessionStorage.setItem(key, JSON.stringify(pending));
    } catch {}
    const id = pending.id,
      payload = {
        name,
        id,
        createdBy: user.uid,
        members: [user.uid],
        isPublic: false,
        favorite: false,
      };
    try {
      await API.commit([
        {
          update: {
            name: API.name("channels/" + id),
            fields: API.fields(payload),
          },
          currentDocument: { exists: false },
        },
        {
          transform: {
            document: API.name("users/" + user.uid),
            fieldTransforms: [
              {
                fieldPath: "channels",
                appendMissingElements: { values: [{ stringValue: id }] },
              },
            ],
          },
          currentDocument: { exists: true },
        },
      ]);
    } catch (error) {
      if (current()?.uid !== user.uid)
        throw Error("Your account changed. Please retry.");
      // An accepted commit can lose its acknowledgement; never create a second room.
      try {
        const saved = await API.read("channels/" + id);
        if (
          !saved.exists ||
          saved.metadata?.fromCache ||
          saved.data().createdBy !== user.uid ||
          !saved.data().members?.includes(user.uid)
        )
          throw error;
        payload.name = saved.data().name || name;
      } catch {
        throw error;
      }
    }
    if (current()?.uid !== user.uid)
      throw Error("Your account changed. Please retry.");
    try {
      sessionStorage.removeItem(key);
    } catch {}
    attempts.delete(user.uid);
    return payload;
  }
  window.LyriaConversations = {
    create,
    clear: (uid) => {
      if (!uid) return;
      attempts.delete(uid);
      try {
        sessionStorage.removeItem("lyria:channel-create:" + uid);
      } catch {}
    },
  };
})();
