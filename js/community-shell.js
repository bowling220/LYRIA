/* Presentation adapter: consumes chat's existing rooms and public profiles, never writes channel metadata. */
(() => {
  const $ = (id) => document.getElementById(id),
    UI = window.LyriaUI;
  let rooms = [],
    user = null,
    selected = null,
    selectionRun = 0,
    filter = "all",
    mediaExpanded = false;
  const profiles = new Map();
  let pinned = [];
  $("rail-activity").append($("friend-request-count"));
  const isMobile = () => matchMedia("(max-width:768px)").matches;
  function syncMobile() {
    const hub = document.querySelector(".chat-area").dataset.view === "hub",
      panel = $("community-sidebar");
    if (isMobile() && hub) {
      panel.removeAttribute("inert");
      panel.setAttribute("aria-hidden", "false");
    }
  }
  function pinKey() {
    return "lyria:pinned-conversations:" + user?.uid;
  }
  function readPins() {
    try {
      pinned = JSON.parse(localStorage.getItem(pinKey())) || [];
      if (!Array.isArray(pinned)) pinned = [];
    } catch {
      pinned = [];
    }
  }
  function cards() {
    const query = $("conversation-search").value.trim().toLowerCase();
    let visible = 0;
    for (const button of $("channels-list").querySelectorAll(
      "[data-channel-id]",
    )) {
      const id = button.dataset.channelId,
        room = rooms.find((item) => item.id === id),
        name = button.querySelector(".channel-name");
      if (!name) continue;
      if (!name.parentElement.classList.contains("conversation-card-copy")) {
        const copy = document.createElement("span");
        copy.className = "conversation-card-copy";
        name.replaceWith(copy);
        copy.append(name);
        const description = document.createElement("span");
        description.className = "conversation-card-description";
        copy.append(description);
      }
      const description =
        room?.description ||
        (id === "community"
          ? "The whole community, together"
          : id === "personal-" + user?.uid
            ? "Just you"
            : Array.isArray(room?.members)
              ? room.members.length +
                " " +
                (room.members.length === 1 ? "person" : "people")
              : "Your shared corner");
      const descriptionNode = name.parentElement.querySelector(
        ".conversation-card-description",
      );
      if (descriptionNode.textContent !== description)
        descriptionNode.textContent = description;
      const unread = Boolean(button.querySelector(".channel-unread"));
      const match =
        (!query || name.textContent.toLowerCase().includes(query)) &&
        (filter === "all" ||
          (filter === "unread" && unread) ||
          (filter === "favorites" && room?.favorite) ||
          (filter === "pinned" && pinned.includes(id)));
      button.closest("li").hidden = !match;
      if (match) visible++;
      button.classList.toggle("conversation-pinned", pinned.includes(id));
    }
    $("conversation-filter-empty").hidden =
      Boolean(visible) || !$("channels-list").children.length;
  }
  const describe = (room) =>
    room?.description ||
    (selected === "community"
      ? "The whole community, together."
      : selected === "personal-" + user?.uid
        ? "Notes, ideas, and a little space for you."
        : "A quiet space to catch up.");
  function media() {
    const grid = $("details-media");
    grid.replaceChildren();
    const images = [
      ...$("messages").querySelectorAll(".message-content img"),
    ].filter((img) => window.LyriaMedia.safeUrl(img.getAttribute("src")));
    const unique = [
      ...new Map(images.map((img) => [img.getAttribute("src"), img])).values(),
    ].reverse();
    for (const img of unique.slice(0, mediaExpanded ? 100 : 6)) {
      const link = document.createElement("a");
      link.href = window.LyriaMedia.safeUrl(img.getAttribute("src"));
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", "Open " + (img.alt || "shared media"));
      const thumb = document.createElement("img");
      thumb.src = link.href;
      thumb.alt = img.alt || "Shared media";
      thumb.loading = "lazy";
      thumb.referrerPolicy = "no-referrer";
      thumb.onerror = () => {
        link.remove();
        if (!grid.children.length) $("details-media-empty").hidden = false;
      };
      link.append(thumb);
      grid.append(link);
    }
    $("details-media-empty").hidden = Boolean(unique.length);
    $("details-media-all").hidden = unique.length <= 6;
    $("details-media-all").textContent = mediaExpanded
      ? "Show less"
      : "See all";
  }
  async function profile(id) {
    if (id === user?.uid) {
      const own = window.LyriaAccount?.getProfile();
      if (own) return own;
    }
    if (profiles.has(id)) return profiles.get(id);
    const doc = await window.LyriaDataAPI.read("profiles/" + id);
    const value = doc.exists ? doc.data() : null;
    if (value) profiles.set(id, value);
    return value;
  }
  function member(id, value, owner) {
    if (!value) {
      const message = [...$("messages").querySelectorAll(".message")].find(
        (node) => node.dataset.senderId === id,
      );
      if (message)
        value = {
          displayName: message.querySelector(".sender-name")?.textContent,
          photoURL: window.LyriaMedia.safeUrl(
            message.querySelector(".sender-avatar")?.getAttribute("src"),
          ),
        };
    }
    const li = document.createElement("li");
    li.className = "member-card";
    const button = document.createElement("button");
    button.type = "button";
    const img = document.createElement("img");
    window.LyriaMedia.image(
      img,
      window.LyriaMedia.profileSource(value || {}),
      "assets/avatar.svg",
    );
    img.alt = "";
    const copy = document.createElement("span"),
      name = document.createElement("strong"),
      status = document.createElement("small");
    name.textContent =
      value?.displayName ||
      (id === user?.uid ? user.displayName : "LYRIA member") ||
      "LYRIA member";
    const administrator = window.LyriaBadges?.forProfile(value || {}, id)?.some(
      (b) => b.id === "admin",
    );
    status.textContent = [
      owner ? "Owner" : administrator ? "Admin" : "",
      value?.status === "available"
        ? "Available"
        : value?.status === "busy"
          ? "Busy"
          : value?.status === "away"
            ? "Away"
            : "Member",
    ]
      .filter(Boolean)
      .join(" · ");
    copy.append(name, status);
    button.append(img, copy);
    button.setAttribute("aria-label", "View " + name.textContent + " profile");
    button.addEventListener("click", () =>
      window.dispatchEvent(
        new CustomEvent("lyria:open-member-profile", { detail: { uid: id } }),
      ),
    );
    li.append(button);
    return li;
  }
  async function members(room, run) {
    const list = $("details-members");
    list.replaceChildren();
    $("details-member-status").textContent = "Loading members…";
    $("details-member-status").hidden = false;
    let ids = Array.isArray(room?.members)
      ? [...new Set(room.members.filter((id) => typeof id === "string"))]
      : [];
    if (selected === "personal-" + user?.uid && !ids.length) ids = [user.uid];
    if (selected === "community") {
      ids = [
        ...new Set(
          [...$("messages").querySelectorAll("[data-sender-id]")]
            .map((el) => el.dataset.senderId)
            .filter(Boolean),
        ),
      ];
      if (user?.uid && !ids.includes(user.uid)) ids.unshift(user.uid);
    }
    $("details-member-count").textContent =
      selected === "community" ? "" : ids.length || "";
    if (!ids.length) {
      $("details-member-status").textContent =
        "Member details aren’t available yet.";
      return;
    }
    const shown = ids.slice(0, 20);
    const data = await Promise.allSettled(shown.map(profile));
    if (run !== selectionRun) return;
    list.replaceChildren(
      ...shown.map((id, index) =>
        member(
          id,
          data[index].status === "fulfilled" ? data[index].value : null,
          room?.createdBy === id,
        ),
      ),
    );
    $("details-member-status").hidden =
      selected !== "community" && ids.length <= 20;
    $("details-member-status").textContent =
      selected === "community"
        ? "People in the loaded conversation."
        : ids.length > 20
          ? "Showing 20 of " + ids.length + " members."
          : "";
  }
  function identity(room) {
    const description = describe(room),
      name = $("channel-title").textContent;
    $("details-title").textContent = name;
    $("details-description").textContent = description;
    $("details-about").textContent = description;
    const count = Array.isArray(room?.members) ? room.members.length : null;
    document.querySelector(".chat-subtitle").textContent =
      (count !== null
        ? count + " " + (count === 1 ? "person" : "people") + " · "
        : "") + description;
    $("conversation-favorite").disabled = !room || selected === "community";
    $("conversation-favorite").setAttribute(
      "aria-pressed",
      String(Boolean(room?.favorite)),
    );
    $("conversation-favorite").setAttribute(
      "aria-label",
      room?.favorite ? "Unfavorite conversation" : "Favorite conversation",
    );
    $("details-settings").hidden = !room || room.createdBy !== user?.uid;
    const date = room?.createdAt?.toDate?.();
    $("details-created").textContent = date
      ? "Created " + date.toLocaleDateString()
      : selected === "community"
        ? "Open to everyone signed in to LYRIA."
        : "";
    $("details-pin").setAttribute(
      "aria-pressed",
      String(pinned.includes(selected)),
    );
    $("details-pin").textContent = pinned.includes(selected)
      ? "Unpin on this device"
      : "Pin on this device";
  }
  function select(id, name, nextUser, nextRooms) {
    if (!id) return;
    user = nextUser || user;
    rooms = nextRooms || rooms;
    readPins();
    const changed = selected !== id;
    selected = id;
    if (changed) {
      mediaExpanded = false;
      $("details-media").replaceChildren();
      $("details-media-empty").hidden = false;
      $("details-media-all").hidden = true;
    }
    const run = changed ? ++selectionRun : selectionRun,
      room = rooms.find((item) => item.id === id);
    identity(room);
    if (changed) {
      members(room, run);
      if (!room && id !== "community")
        window.LyriaDataAPI.read("channels/" + id)
          .then((doc) => {
            if (run !== selectionRun || !doc.exists) return;
            const info = { ...doc.data(), id };
            rooms = [...rooms.filter((r) => r.id !== id), info];
            identity(info);
            members(info, run);
          })
          .catch(() => {});
    }
    $("details-invite").disabled = false;
    $("details-invite-people").disabled = false;
    $("details-pin").disabled = false;
    syncMobile();
  }
  function hub() {
    selected = null;
    ++selectionRun;
    $("details-title").textContent = "Your corner of LYRIA";
    $("details-description").textContent =
      "Pick a conversation. Make yourself at home.";
    $("details-about").textContent =
      "Conversations, people, and shared moments, all in your corner of LYRIA.";
    $("details-created").textContent = "";
    $("details-members").replaceChildren();
    $("details-member-count").textContent = "";
    $("details-member-status").textContent =
      "Choose a conversation to see its members.";
    $("details-member-status").hidden = false;
    $("details-settings").hidden = true;
    $("details-invite").disabled = true;
    $("details-invite-people").disabled = true;
    $("details-pin").disabled = true;
    $("details-media").replaceChildren();
    $("details-media-empty").hidden = false;
    syncMobile();
  }
  function setRooms(next, nextUser) {
    rooms = next;
    const changed = user?.uid !== nextUser?.uid;
    user = nextUser;
    if (changed) {
      profiles.clear();
      readPins();
    }
    const status = window.LyriaAccount?.getProfile()?.status;
    $("user-profile-trigger").dataset.status = [
      "available",
      "away",
      "busy",
    ].includes(status)
      ? status
      : "";
    cards();
    if (selected) {
      const room = rooms.find((r) => r.id === selected);
      identity(room);
      members(room, selectionRun);
    }
    syncMobile();
  }
  const forward = (id, target) =>
    $(id).addEventListener("click", () => $(target).click());
  forward("composer-image", "gif-button");
  forward("panel-create", "add-channel");
  forward("rail-chats", "open-hub");
  forward("rail-discover", "news-feed-button");
  forward("rail-activity", "inbox-btn");
  forward("rail-settings", "settings-btn");
  forward("details-invite", "copy-join-code");
  forward("details-invite-people", "copy-join-code");
  $("details-settings").addEventListener("click", () => {
    if (rooms.find((room) => room.id === selected)?.createdBy !== user?.uid)
      return;
    $("settings-leave-conversation").disabled = $("leave-channel").disabled;
    UI.openModal($("conversation-settings-modal"));
  });
  $("settings-manage-invite").addEventListener("click", () => {
    UI.closeModal($("conversation-settings-modal"));
    $("copy-join-code").click();
  });
  $("settings-leave-conversation").addEventListener("click", () => {
    UI.closeModal($("conversation-settings-modal"));
    $("leave-channel").click();
  });
  $("conversation-favorite").addEventListener("click", () => {
    if (selected)
      document
        .querySelector(
          '.channel-btn[data-channel-id="' + CSS.escape(selected) + '"]',
        )
        ?.closest("li")
        ?.querySelector(".favorite-btn")
        ?.click();
  });
  $("conversation-search").addEventListener("input", cards);
  document.querySelectorAll("[data-filter]").forEach((button) =>
    button.addEventListener("click", () => {
      filter = button.dataset.filter;
      document
        .querySelectorAll("[data-filter]")
        .forEach((el) =>
          el.setAttribute("aria-pressed", String(el === button)),
        );
      cards();
    }),
  );
  $("details-pin").addEventListener("click", () => {
    if (!user || !selected) return;
    pinned = pinned.includes(selected)
      ? pinned.filter((id) => id !== selected)
      : [...pinned, selected];
    try {
      localStorage.setItem(pinKey(), JSON.stringify(pinned));
      identity(rooms.find((r) => r.id === selected));
      cards();
    } catch {
      UI.notify("Your browser could not save this pin.", "error");
    }
  });
  $("details-media-all").addEventListener("click", () => {
    mediaExpanded = !mediaExpanded;
    media();
  });
  const dialog = $("conversation-details-dialog"),
    details = $("conversation-details");
  $("conversation-details-toggle").addEventListener("click", () => {
    $("details-drawer-host").append(details);
    UI.openModal(dialog);
  });
  $("close-conversation-details").addEventListener("click", () =>
    UI.closeModal(dialog),
  );
  new MutationObserver(() => {
    if (
      dialog.dataset.uiOpen === "false" &&
      details.parentElement === $("details-drawer-host")
    )
      document.querySelector(".lyria-shell").append(details);
  }).observe(dialog, { attributes: true, attributeFilter: ["data-ui-open"] });
  const tools = $("composer-tools-modal");
  $("composer-tools").addEventListener("click", () => UI.openModal(tools));
  $("composer-emoji").addEventListener("click", () => {
    UI.openModal(tools);
    $("composer-emojis").querySelector("button")?.focus();
  });
  $("close-composer-tools").addEventListener("click", () =>
    UI.closeModal(tools),
  );
  for (const [id, target] of [
    ["tools-gif", "gif-button"],
    ["tools-invite", "copy-join-code"],
    ["tools-voice", "make-voice-call"],
  ])
    $(id).addEventListener("click", () => {
      UI.closeModal(tools);
      $(target).click();
    });
  function insert(text) {
    const input = $("message-input");
    if (input.value.length + text.length > input.maxLength) return;
    UI.closeModal(tools);
    input.focus();
    input.setRangeText(text, input.selectionStart, input.selectionEnd, "end");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  $("tools-mention").addEventListener("click", () => insert("@"));
  for (const emoji of ["😊", "💚", "🎉", "🙌", "🌿", "✨", "👍", "❤️"]) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = emoji;
    button.setAttribute("aria-label", "Insert " + emoji);
    button.addEventListener("click", () => insert(emoji));
    $("composer-emojis").append(button);
  }
  let paintScheduled = false;
  new MutationObserver(() => {
    if (paintScheduled) return;
    paintScheduled = true;
    requestAnimationFrame(() => {
      paintScheduled = false;
      cards();
    });
  }).observe($("channels-list"), { childList: true, subtree: true });
  // Avoid recursive card mutations: descriptions are only rewritten when changed.
  let mediaTimer;
  new MutationObserver(() => {
    clearTimeout(mediaTimer);
    mediaTimer = setTimeout(() => {
      if (selected) {
        media();
        if (selected === "community") members(null, selectionRun);
      }
    }, 100);
  }).observe($("messages"), { childList: true, subtree: true });
  new MutationObserver(syncMobile).observe(
    document.querySelector(".chat-area"),
    { attributes: true, attributeFilter: ["data-view"] },
  );
  matchMedia("(max-width:768px)").addEventListener("change", syncMobile);
  window.LyriaShell = { select, rooms: setRooms, hub };
})();
