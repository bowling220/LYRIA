/* Private blocking and explicit abuse reports. Firestore rules authorize every write. */
(() => {
  const API = window.LyriaDataAPI,
    UI = window.LyriaUI,
    $ = (id) => document.getElementById(id);
  let uid = null,
    blocked = new Set(),
    off,
    ready = Promise.resolve(),
    epoch = 0,
    target = null,
    reportAttempt = null,
    loaded = false,
    settleReady = () => {};
  const current = () => window.firebaseConfig.getAuth().currentUser;
  const moderator = () => {
    const p = window.LyriaAccount?.getProfile() || {};
    return (
      ["admin", "moderator"].includes(p.role) ||
      (Array.isArray(p.badges) ? p.badges : []).some((b) =>
        ["admin", "administrator", "moderator", "mod"].includes(
          typeof b === "string" ? b.trim().toLowerCase() : "",
        ),
      )
    );
  };
  function apply() {
    for (const node of document.querySelectorAll(
      ".message[data-sender-id],.inbox-message[data-sender-id]",
    ))
      node.hidden = blocked.has(node.dataset.senderId);
    renderBlocked();
    window.dispatchEvent(new Event("lyria:blocks-updated"));
  }
  function renderBlocked() {
    const host = $("blocked-users");
    if (!host) return;
    host.replaceChildren();
    if (!blocked.size)
      host.append(
        Object.assign(document.createElement("p"), {
          textContent: "No blocked members.",
        }),
      );
    for (const id of blocked) {
      const row = document.createElement("div"),
        label = document.createElement("span"),
        b = document.createElement("button");
      label.textContent = "Blocked member";
      b.type = "button";
      b.textContent = "Unblock";
      b.onclick = async () => {
        b.disabled = true;
        try {
          await setBlock(id, false);
        } catch (e) {
          UI.notify(e.message, "error");
          b.disabled = false;
        }
      };
      row.append(label, b);
      host.append(row);
      API.read("profiles/" + id)
        .then((p) => {
          if (row.isConnected)
            label.textContent = p.data()?.displayName || "Blocked member";
        })
        .catch(() => {});
    }
  }
  async function setBlock(id, on) {
    if (on && !blocked.has(id) && blocked.size >= 100)
      throw Error(
        "You can manage up to 100 blocked members here. Unblock someone before adding another.",
      );
    if (!current() || id === current().uid)
      throw Error("Choose another member.");
    const owner = current().uid,
      path = "users/" + owner + "/blocks/" + id;
    await API.commit(
      on
        ? [
            {
              update: { name: API.name(path), fields: {} },
              updateTransforms: [
                { fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" },
              ],
            },
          ]
        : [{ delete: API.name(path) }],
    );
    if (current()?.uid !== owner) return;
    on ? blocked.add(id) : blocked.delete(id);
    apply();
    UI.notify(
      on
        ? "Member blocked. Their messages, requests, and call invitations are hidden. Shared voice rooms are not private."
        : "Member unblocked.",
    );
    profile(id);
  }
  function profile(id) {
    const host = $("profile-safety-actions");
    if (!host) return;
    host.replaceChildren();
    if (!id || id === current()?.uid) return;
    for (const control of [$("send-friend-request"), $("call-profile-user")])
      if (control) control.disabled = blocked.has(id);
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = blocked.has(id) ? "Unblock member" : "Block member";
    b.onclick = async () => {
      b.disabled = true;
      try {
        await setBlock(id, !blocked.has(id));
      } catch (e) {
        UI.notify(e.message, "error");
        b.disabled = false;
      }
    };
    const r = document.createElement("button");
    r.type = "button";
    r.textContent = "Report member";
    r.onclick = () => openReport({ targetUserId: id });
    host.append(b, r);
  }
  function openReport(value) {
    target = value;
    reportAttempt = null;
    $("report-submit").disabled = false;
    $("report-details").value = "";
    $("report-reason").value = "spam";
    $("report-status").textContent = "";
    UI.openModal($("report-modal"));
  }
  function mount(message, data, channel, id) {
    if (!data.senderId || data.senderId === current()?.uid) return;
    const actions =
      message.querySelector(".message-reactions") ||
      document.createElement("div");
    actions.classList.add("message-safety-actions");
    const b = document.createElement("button");
    b.className = "message-report-button";
    b.type = "button";
    b.textContent = "Report";
    b.setAttribute(
      "aria-label",
      "Report message from " + (data.sender || "member"),
    );
    b.onclick = () =>
      openReport({
        targetUserId: data.senderId,
        channelId: channel,
        messageId: id,
        evidenceText: String(
          data.message ||
            data.content ||
            (data.type === "gif" ? "GIF message" : ""),
        ).slice(0, 4000),
      });
    actions.append(b);
    if (!message.contains(actions)) message.append(actions);
    message.hidden = blocked.has(data.senderId);
  }
  async function submit(event) {
    event.preventDefault();
    const b = $("report-submit"),
      owner = current()?.uid;
    if (!owner || !target || b.disabled) return;
    b.disabled = true;
    const payload = {
      ...target,
      reporterId: owner,
      reason: $("report-reason").value,
      details: $("report-details").value.trim().slice(0, 1000),
      status: "open",
    };
    const fingerprint = JSON.stringify(payload);
    const retry = reportAttempt?.fingerprint === fingerprint;
    if (!retry) reportAttempt = { id: crypto.randomUUID(), fingerprint };
    const id = reportAttempt.id;
    $("report-status").textContent = "Submitting report…";
    try {
      const previous = retry ? await API.read("abuseReports/" + id) : null;
      const confirmed =
        previous?.exists &&
        Object.entries(payload).every(
          ([key, value]) => key === "status" || previous.data()[key] === value,
        );
      if (!confirmed)
        await API.commit([
          {
            update: {
              name: API.name("abuseReports/" + id),
              fields: API.fields(payload),
            },
            updateTransforms: [
              { fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" },
            ],
            currentDocument: { exists: false },
          },
        ]);
      if (current()?.uid !== owner) return;
      $("report-status").textContent =
        "Report submitted for moderator review. Thank you.";
      target = null;
    } catch (e) {
      $("report-status").textContent = e.rateLimited
        ? e.message
        : "Report not confirmed. Please retry when connected.";
    } finally {
      b.disabled = target === null;
    }
  }
  async function queue() {
    const host = $("moderation-reports");
    UI.openModal($("moderation-modal"));
    host.textContent = "Loading reports…";
    try {
      const reports = await API.query("abuseReports", {
        where: API.equal("status", "open"),
        limit: 30,
      });
      host.replaceChildren();
      if (reports.empty)
        host.textContent = "No open reports. You’re caught up.";
      for (const report of reports.docs) {
        const d = report.data(),
          row = document.createElement("article");
        row.className = "moderation-report";
        row.dataset.reportId = report.id;
        const member = document.createElement("button");
        member.type = "button";
        member.textContent = "View reported member";
        member.onclick = () => {
          UI.closeModal($("moderation-modal"));
          window.dispatchEvent(
            new CustomEvent("lyria:open-member-profile", {
              detail: { uid: d.targetUserId },
            }),
          );
        };
        row.append(member);
        const text = document.createElement("p");
        text.textContent =
          d.reason +
          ": " +
          (d.details || "No additional details.") +
          "\nReported content: " +
          (d.evidenceText || "Profile report");
        row.append(text);
        for (const action of ["resolved", "dismissed"]) {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = action === "resolved" ? "Resolve" : "Dismiss";
          b.onclick = async () => {
            b.disabled = true;
            try {
              await API.commit([
                {
                  update: {
                    name: API.name("abuseReports/" + report.id),
                    fields: API.fields({
                      status: action,
                      reviewedBy: current().uid,
                    }),
                  },
                  updateMask: {
                    fieldPaths: ["status", "reviewedBy", "reviewedAt"],
                  },
                  updateTransforms: [
                    {
                      fieldPath: "reviewedAt",
                      setToServerValue: "REQUEST_TIME",
                    },
                  ],
                  currentDocument: { exists: true },
                },
              ]);
              row.remove();
              if (!host.children.length)
                host.textContent = "No open reports. You’re caught up.";
            } catch {
              b.disabled = false;
              UI.notify("Review could not be saved.", "error");
            }
          };
          row.append(b);
        }
        if (d.channelId && d.messageId) {
          const remove = document.createElement("button");
          remove.type = "button";
          remove.textContent = "Remove reported message";
          remove.onclick = async () => {
            if (
              !confirm(
                "Remove this message from the conversation? The report remains for review.",
              )
            )
              return;
            remove.disabled = true;
            try {
              await API.commit([
                {
                  delete: API.name(
                    "channels/" + d.channelId + "/messages/" + d.messageId,
                  ),
                  currentDocument: { exists: true },
                },
              ]);
              UI.notify(
                "Message removed. Resolve the report when your review is complete.",
              );
            } catch {
              remove.disabled = false;
              UI.notify(
                "Could not remove this message. You must be a moderator and a member of its conversation.",
                "error",
              );
            }
          };
          row.append(remove);
        }
        host.append(row);
      }
    } catch {
      host.textContent =
        "Reports could not load. This view requires a moderator account.";
    }
  }
  function refreshRole() {
    if ($("open-moderation")) $("open-moderation").hidden = !moderator();
  }
  $("report-form")?.addEventListener("submit", submit);
  $("close-report")?.addEventListener("click", () =>
    UI.closeModal($("report-modal")),
  );
  $("close-moderation")?.addEventListener("click", () =>
    UI.closeModal($("moderation-modal")),
  );
  $("open-moderation")?.addEventListener("click", queue);
  window.addEventListener("lyria:profile-updated", refreshRole);
  window.addEventListener("lyria:retry", () => off?.refresh?.());
  window.LyriaSafety = {
    isBlocked: (id) => blocked.has(id),
    check: async (id) => {
      const owner = current()?.uid;
      await ready;
      if (current()?.uid !== owner)
        throw Error("Account changed. Please retry.");
      if (!loaded)
        throw Error(
          "Block settings are unavailable. Reconnect before contacting this member.",
        );
      return blocked.has(id);
    },
    setBlock,
    mount,
    profile,
    applyMessages: () => {
      for (const n of document.querySelectorAll(
        ".message[data-sender-id],.inbox-message[data-sender-id]",
      ))
        n.hidden = blocked.has(n.dataset.senderId);
    },
    isModerator: moderator,
  };
  (async () => {
    await window.firebaseConfig.initialize();
    window.firebaseConfig.getAuth().onAuthStateChanged((user) => {
      settleReady();
      off?.();
      const run = ++epoch;
      uid = user?.uid;
      loaded = false;
      blocked = new Set();
      apply();
      if (!uid) return;
      let settled;
      ready = new Promise((resolve) => (settled = resolve));
      settleReady = settled;
      window.LyriaConnection?.pending("safety");
      const ref = window.firebaseConfig
        .getFirestore()
        .collection("users")
        .doc(uid)
        .collection("blocks")
        .limit(100);
      off = API.watch(
        ref,
        "blocks",
        { parent: "users/" + uid, limit: 100 },
        (snap) => {
          if (run !== epoch) return;
          blocked = new Set(snap.docs.map((d) => d.id));
          loaded = true;
          window.LyriaConnection?.ready("safety");
          apply();
          if ($("profile-modal")?.dataset.userId)
            profile($("profile-modal").dataset.userId);
          settled();
        },
        () => {
          if (run === epoch) {
            settled();
            window.LyriaConnection?.fail(
              "safety",
              "Privacy settings couldn’t load. Reconnect to restore block controls.",
            );
          }
        },
      );
    });
  })().catch(() => {});
})();
