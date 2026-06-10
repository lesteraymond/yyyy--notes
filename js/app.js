let boards = [];
let currentBoardIndex = 0;
let currentMessages = [];

async function init() {
	await fetchBoards();
	if (boards.length === 0) {
		await addNewBoard();
	} else {
		await loadBoard(0);
	}
}

async function refreshAll() {
	const canvas = document.getElementById("sticky-canvas");
	canvas.style.opacity = "0.5";
	try {
		await fetchBoards();
		if (boards.length > 0) {
			if (currentBoardIndex >= boards.length) {
				currentBoardIndex = 0;
			}
			await loadBoard(currentBoardIndex);
		}
	} finally {
		canvas.style.opacity = "";
	}
}

async function fetchBoards() {
	try {
		const res = await fetch("/api/canvases");
		const data = await res.json();
		if (!res.ok) throw new Error(data.error || "Failed to fetch boards");
		boards = Array.isArray(data) ? data : [];
		renderBoardPagination();
	} catch (e) {
		console.error("Failed to fetch boards:", e.message);
		boards = [];
		renderBoardPagination();
	}
}

async function fetchMessages(boardId) {
	try {
		const res = await fetch(`/api/messages?boardId=${boardId}`);
		const data = await res.json();
		if (!res.ok) throw new Error(data.error || "Failed to fetch messages");
		currentMessages = Array.isArray(data) ? data : [];
		renderMessages();
	} catch (e) {
		console.error("Failed to fetch messages:", e.message);
		currentMessages = [];
		renderMessages();
	}
}

async function loadBoard(index) {
	currentBoardIndex = index;
	const board = boards[currentBoardIndex];
	if (board) {
		await fetchMessages(board.id);
	}
	renderBoardPagination();
}

async function checkName() {
	const input = document.getElementById("name-input");
	const card = document.getElementById("auth-card");
	const error = document.getElementById("error-msg");
	const name = input.value.trim();

	if (!name) return;

	try {
		const res = await fetch("/api/auth", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name }),
		});
		const data = await res.json();

		if (data.allowed) {
			createHeartBurst();
			document.getElementById("auth-screen").classList.add("fade-out");
			setTimeout(async () => {
				document.getElementById("auth-screen").style.display = "none";
				const main = document.getElementById("main-content");
				main.classList.remove("opacity-0", "pointer-events-none");
				main.classList.add("fade-in");
				await init(); 
			}, 600);
		} else {
			card.classList.add("shake");
			error.classList.add("opacity-100");
			setTimeout(() => card.classList.remove("shake"), 400);
		}
	} catch (err) {
		console.error("Auth error:", err);
		error.classList.add("opacity-100");
		error.innerText = "Something went wrong. Try again?";
	}
}

async function postMessage() {
	const input = document.getElementById("message-input");
	const text = input.value.trim();
	if (!text) return;

	const now = new Date();
	const board = boards[currentBoardIndex];
	if (!board) return;

	const tempId = `temp-${Date.now()}`;
	const optimisticMessage = {
		id: tempId,
		board_id: board.id,
		text: text,
		time: now.toLocaleString("en-US", {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		}),
		x: Math.random() * 70 + 5,
		y: Math.random() * 60 + 5,
		rotation: Math.random() * 10 - 5,
		created_at: now.toISOString(),
		isOptimistic: true,
	};

	currentMessages.push(optimisticMessage);
	input.value = "";
	renderMessages();

	createHeartExplosion(optimisticMessage.x, optimisticMessage.y);

	const canvas = document.getElementById("sticky-canvas");
	canvas.classList.add("camera-shake");
	setTimeout(() => canvas.classList.remove("camera-shake"), 400);

	try {
		const res = await fetch("/api/post-message", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				board_id: optimisticMessage.board_id,
				text: optimisticMessage.text,
				time: optimisticMessage.time,
				x: optimisticMessage.x,
				y: optimisticMessage.y,
				rotation: optimisticMessage.rotation,
			}),
		});
		const newMessage = await res.json();
		if (!res.ok) throw new Error(newMessage.error || "Failed to post message");

		const index = currentMessages.findIndex((m) => m.id === tempId);
		if (index !== -1) {
			const existing = currentMessages[index];
			currentMessages[index] = {
				...newMessage,
				x: existing.x,
				y: existing.y,
				rotation: existing.rotation,
				liked: existing.liked,
			};
			renderMessages();
		}
	} catch (e) {
		console.error("Failed to post message:", e.message);
		currentMessages = currentMessages.filter((m) => m.id !== tempId);
		renderMessages();
		if (input.value === "") {
			input.value = text;
		}
	}
}

function makeDraggable(note, msg) {
	const canvas = document.getElementById("sticky-canvas");
	let isDragging = false;
	let hasMoved = false;
	let startX, startY, startLeftPx, startTopPx;

	function beginDrag(clientX, clientY) {
		const rect = canvas.getBoundingClientRect();
		isDragging = true;
		hasMoved = false;
		startX = clientX;
		startY = clientY;
		startLeftPx = (parseFloat(note.style.left) / 100) * rect.width;
		startTopPx = (parseFloat(note.style.top) / 100) * rect.height;

		note.classList.add("dragging");
		note.style.zIndex = 60;
		note.style.transition = "none";
	}

	function moveDrag(clientX, clientY) {
		if (!isDragging) return;
		const rect = canvas.getBoundingClientRect();
		const dx = clientX - startX;
		const dy = clientY - startY;

		if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;

		const noteWidth = note.offsetWidth;
		const noteHeight = note.offsetHeight;

		let newLeft = Math.max(
			0,
			Math.min(rect.width - noteWidth, startLeftPx + dx),
		);
		let newTop = Math.max(
			0,
			Math.min(rect.height - noteHeight, startTopPx + dy),
		);

		note.style.left = (newLeft / rect.width) * 100 + "%";
		note.style.top = (newTop / rect.height) * 100 + "%";
	}

	async function endDrag() {
		if (!isDragging) return;
		isDragging = false;
		note.classList.remove("dragging");
		note.style.zIndex = "";
		note.style.transition = "";

		if (hasMoved) {
			const newX = parseFloat(note.style.left);
			const newY = parseFloat(note.style.top);
			msg.x = newX;
			msg.y = newY;
			await updateMessage(msg.id, { x: newX, y: newY });
		}
	}

	note.addEventListener("mousedown", (e) => {
		if (e.target.closest("button")) return;
		e.preventDefault();
		beginDrag(e.clientX, e.clientY);
		const onMove = (ev) => moveDrag(ev.clientX, ev.clientY);
		const onUp = () => {
			endDrag();
			document.removeEventListener("mousemove", onMove);
			document.removeEventListener("mouseup", onUp);
		};
		document.addEventListener("mousemove", onMove);
		document.addEventListener("mouseup", onUp);
	});

	note.addEventListener(
		"touchstart",
		(e) => {
			if (e.target.closest("button")) return;
			const t = e.touches[0];
			beginDrag(t.clientX, t.clientY);
			const onMove = (ev) => {
				ev.preventDefault();
				moveDrag(ev.touches[0].clientX, ev.touches[0].clientY);
			};
			const onEnd = () => {
				endDrag();
				document.removeEventListener("touchmove", onMove);
				document.removeEventListener("touchend", onEnd);
			};

			document.addEventListener("touchmove", onMove, { passive: false });
			document.addEventListener("touchend", onEnd);
		},
		{ passive: true },
	);
}

async function updateMessage(id, updates) {
	if (typeof id === "string" && id.startsWith("temp-")) {
		const msg = currentMessages.find((m) => m.id === id);
		if (msg) Object.assign(msg, updates);
		return;
	}
	try {
		const res = await fetch("/api/messages", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id, ...updates }),
		});
		if (!res.ok) {
			const data = await res.json();
			throw new Error(data.error || "Failed to update message");
		}
	} catch (e) {
		console.error("Failed to update message:", e.message);
	}
}

function renderMessages() {
	const canvas = document.getElementById("sticky-canvas");
	canvas.innerHTML = "";

	const currentBoard = boards[currentBoardIndex];
	const boardType = currentBoard ? currentBoard.type || "sticky" : "sticky";

	currentMessages.forEach((msg) => {
		if (boardType === "envelope") {
			renderEnvelope(canvas, msg);
		} else {
			renderStickyNote(canvas, msg);
		}
	});
}

function renderStickyNote(canvas, msg) {
	const note = document.createElement("div");
	const isNew = Date.now() - new Date(msg.created_at).getTime() < 1000;
	note.className = `canvas-note glass-card note-glow${isNew ? " pop-in" : ""}${
		msg.isOptimistic ? " note-pending" : ""
	}`;
	note.style.left = `${msg.x}%`;
	note.style.top = `${msg.y}%`;
	note.style.setProperty("--note-rotation", `${msg.rotation}deg`);

	note.innerHTML = `
        <button class="note-delete-btn" title="Delete note">
            <span class="material-symbols-outlined">close</span>
        </button>
        <p class="note-text">"${msg.text}"</p>
        <div class="note-footer">
            <span class="note-time">${msg.time || "Sweet moments"}</span>
            <button class="note-heart-btn${msg.liked ? " liked" : ""}" title="Love this note">
                <span class="material-symbols-outlined material-symbols-fill">favorite</span>
            </button>
        </div>
    `;

	note.querySelector(".note-delete-btn").addEventListener("click", (e) => {
		e.stopPropagation();
		deleteMessage(msg.id, note);
	});

	note
		.querySelector(".note-heart-btn")
		.addEventListener("click", async (e) => {
			e.stopPropagation();
			e.preventDefault();
			const btn = e.currentTarget;
			msg.liked = !msg.liked;
			btn.classList.toggle("liked", msg.liked);
			await updateMessage(msg.id, { liked: msg.liked });
			btn.classList.add("heart-pop");
			setTimeout(() => btn.classList.remove("heart-pop"), 400);
			const noteRect = note.getBoundingClientRect();
			const canvasRect = canvas.getBoundingClientRect();
			const centerX = noteRect.left - canvasRect.left + noteRect.width / 2;
			const centerY = noteRect.top - canvasRect.top + noteRect.height / 2;
			spawnNoteHearts(canvas, centerX, centerY);
		});

	makeDraggable(note, msg);
	canvas.appendChild(note);
}

function renderEnvelope(canvas, msg) {
	const wrapper = document.createElement("div");
	const isNew = Date.now() - new Date(msg.created_at).getTime() < 1000;
	wrapper.className = `envelope-wrapper${isNew ? " pop-in" : ""}${
		msg.isOptimistic ? " note-pending" : ""
	}`;
	wrapper.style.left = `${msg.x}%`;
	wrapper.style.top = `${msg.y}%`;

	wrapper.innerHTML = `
        <div class="envelope">
            <div class="envelope-front">
                <div class="envelope-seal">
                    <span class="material-symbols-outlined material-symbols-fill">favorite</span>
                </div>
            </div>
            <div class="letter-content">
                <p class="letter-text">${msg.text}</p>
                <div class="letter-footer">
                    <span class="letter-time">${msg.time || "Sweet moments"}</span>
                    <button class="note-heart-btn${msg.liked ? " liked" : ""}" title="Love this">
                        <span class="material-symbols-outlined material-symbols-fill">favorite</span>
                    </button>
                </div>
            </div>
        </div>
        <div class="envelope-actions">
            <button class="btn-envelope-action delete" title="Delete">
                <span class="material-symbols-outlined">delete</span>
            </button>
        </div>
    `;

	const envelope = wrapper.querySelector(".envelope");
	wrapper.addEventListener("click", (e) => {
		if (e.target.closest("button")) return;
		wrapper.classList.toggle("open");
	});

	wrapper.querySelector(".delete").addEventListener("click", (e) => {
		e.stopPropagation();
		deleteMessage(msg.id, wrapper);
	});

	const heartBtn = wrapper.querySelector(".note-heart-btn");
	heartBtn.addEventListener("click", async (e) => {
		e.stopPropagation();
		msg.liked = !msg.liked;
		heartBtn.classList.toggle("liked", msg.liked);
		await updateMessage(msg.id, { liked: msg.liked });

		const rect = wrapper.getBoundingClientRect();
		const canvasRect = canvas.getBoundingClientRect();
		spawnNoteHearts(canvas, rect.left - canvasRect.left + rect.width / 2, rect.top - canvasRect.top + rect.height / 2);
	});

	makeDraggable(wrapper, msg);
	canvas.appendChild(wrapper);
}

function spawnNoteHearts(container, cx, cy) {
	const count = 8;
	for (let i = 0; i < count; i++) {
		const heart = document.createElement("span");
		heart.className =
			"material-symbols-outlined note-heart-particle material-symbols-fill";
		heart.innerText = "favorite";
		heart.style.left = cx + "px";
		heart.style.top = cy + "px";
		const angle = ((Math.PI * 2) / count) * i + (Math.random() * 0.5 - 0.25);
		const dist = Math.random() * 60 + 40;
		const tx = Math.cos(angle) * dist;
		const ty = Math.sin(angle) * dist;
		const size = Math.random() * 10 + 10;
		heart.style.fontSize = size + "px";
		heart.style.setProperty("--tx", tx + "px");
		heart.style.setProperty("--ty", ty + "px");
		container.appendChild(heart);
		setTimeout(() => heart.remove(), 800);
	}
}

async function deleteMessage(id, noteEl) {
	noteEl.classList.add("note-exit-animation");

	if (typeof id === "string" && id.startsWith("temp-")) {
		setTimeout(() => {
			currentMessages = currentMessages.filter((m) => m.id !== id);
			renderMessages();
		}, 500);
		return;
	}

	try {
		const res = await fetch("/api/messages", {
			method: "DELETE",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id }),
		});
		if (!res.ok) {
			const data = await res.json();
			throw new Error(data.error || "Failed to delete message");
		}

		setTimeout(() => {
			currentMessages = currentMessages.filter((m) => m.id !== id);
			renderMessages();
		}, 500);
	} catch (e) {
		console.error("Failed to delete message:", e.message);
	}
}

let modalResolve;

function showCustomModal(title, message, icon) {
	document.getElementById("modal-title").innerText = title;
	document.getElementById("modal-message").innerText = message;
	document.getElementById("modal-icon").innerText = icon;
	document.getElementById("custom-modal").classList.add("active");

	return new Promise((resolve) => {
		modalResolve = resolve;
	});
}

function closeModal(result) {
	document.getElementById("custom-modal").classList.remove("active");
	if (modalResolve) {
		modalResolve(result);
		modalResolve = null;
	}
}

async function clearBoard() {
	const notes = document.querySelectorAll(".canvas-note");
	if (notes.length === 0) return;

	const confirmed = await showCustomModal(
		"Erase Notes",
		"Erase all notes on this page? (The page will stay)",
		"🪄",
	);

	if (confirmed) {
		notes.forEach((note, i) => {
			setTimeout(() => {
				note.classList.add("note-exit-animation");
			}, i * 50);
		});

		try {
			const res = await fetch("/api/messages", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ boardId: boards[currentBoardIndex].id }),
			});
			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || "Failed to clear board");
			}

			setTimeout(
				() => {
					currentMessages = [];
					renderMessages();
				},
				notes.length * 50 + 500,
			);
		} catch (e) {
			console.error("Failed to clear board:", e.message);
		}
	}
}

async function removeCurrentBoard() {
	if (boards.length <= 1) {
		const confirmed = await showCustomModal(
			"Only Page!",
			"This is your only page! Just erase the notes instead?",
			"🌸",
		);
		if (confirmed) {
			clearBoard();
		}
		return;
	}

	const confirmed = await showCustomModal(
		"Delete Page",
		"Delete this ENTIRE page? (Page will be gone forever)",
		"🗑️",
	);

	if (confirmed) {
		const boardId = boards[currentBoardIndex].id;
		try {
			const res = await fetch("/api/canvases", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id: boardId }),
			});
			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || "Failed to remove board");
			}

			boards.splice(currentBoardIndex, 1);
			if (currentBoardIndex >= boards.length) {
				currentBoardIndex = boards.length - 1;
			}
			await loadBoard(currentBoardIndex);
		} catch (e) {
			console.error("Failed to remove board:", e.message);
		}
	}
}

let typeModalResolve;

async function addNewBoard() {
	if (boards.length >= 10) {
		alert("You've reached the maximum number of pages!");
		return;
	}

	document.getElementById("type-modal").classList.add("active");
	const type = await new Promise((resolve) => {
		typeModalResolve = resolve;
	});

	if (!type) return;

	try {
		const res = await fetch("/api/canvases", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: `Page ${boards.length + 1}`,
				type: type
			}),
		});
		const newBoard = await res.json();
		if (!res.ok) throw new Error(newBoard.error || "Failed to add new board");

		boards.push(newBoard);
		currentBoardIndex = boards.length - 1;
		await loadBoard(currentBoardIndex);
		createHeartBurst();
	} catch (e) {
		console.error("Failed to add new board:", e.message);
	}
}

function closeTypeModal(type) {
	document.getElementById("type-modal").classList.remove("active");
	if (typeModalResolve) {
		typeModalResolve(type);
		typeModalResolve = null;
	}
}

async function switchBoard(index) {
	if (currentBoardIndex === index) return;

	const canvas = document.getElementById("sticky-canvas");
	canvas.style.transition = "opacity 0.3s ease, transform 0.3s ease";
	canvas.style.opacity = "0";
	canvas.style.transform = "scale(0.98)";

	setTimeout(async () => {
		await loadBoard(index);

		canvas.classList.remove("canvas-fade-in");
		void canvas.offsetWidth;
		canvas.classList.add("canvas-fade-in");

		canvas.style.opacity = "";
		canvas.style.transform = "";
	}, 300);
}

function renderBoardPagination() {
	const desktopContainer = document.getElementById("board-pagination");
	const mobileContainer = document.getElementById("board-pagination-mobile");

	if (desktopContainer) {
		desktopContainer.innerHTML = "";
		boards.forEach((board, index) => {
			const dot = document.createElement("button");
			dot.className = `page-dot${index === currentBoardIndex ? " active" : ""}`;
			dot.onclick = () => switchBoard(index);
			dot.title = `Page ${index + 1}`;
			desktopContainer.appendChild(dot);
		});
	}

	if (mobileContainer) {
		mobileContainer.innerHTML = "";
		boards.forEach((board, index) => {
			const item = document.createElement("button");
			item.className = `menu-item page-list-item${
				index === currentBoardIndex ? " active" : ""
			}`;
			item.innerHTML = `
				<span>Page ${index + 1}</span>
				${
					index === currentBoardIndex
						? '<span class="material-symbols-outlined ms-auto">check</span>'
						: ""
				}
			`;
			item.onclick = () => {
				switchBoard(index);
			};
			mobileContainer.appendChild(item);
		});
	}
}

function toggleMenu() {
	const menu = document.getElementById("mobile-menu");
	const trigger = document.getElementById("mobile-menu-trigger");

	menu.classList.toggle("active");
	trigger.classList.toggle("active");

	if (!menu.classList.contains("active")) {
		showSubmenu("main");
	}
}

function showSubmenu(type) {
	const main = document.getElementById("menu-main");
	const pages = document.getElementById("menu-pages");

	if (type === "pages") {
		main.classList.add("hidden");
		pages.classList.remove("hidden");
	} else {
		main.classList.remove("hidden");
		pages.classList.add("hidden");
	}
}

function createHeartBurst() {
	const container = document.getElementById("heart-container");
	for (let i = 0; i < 30; i++) {
		setTimeout(() => {
			const x = 50 + (Math.random() - 0.5) * 40;
			const y = 50 + (Math.random() - 0.5) * 40;
			createHeartAt(x, y);
		}, i * 50);
	}
}

function createHeartAt(x, y) {
	const container = document.getElementById("heart-container");
	const heart = document.createElement("span");
	heart.className =
		"material-symbols-outlined floating-heart text-secondary material-symbols-fill";
	heart.innerText = "favorite";
	heart.style.left = x + "%";
	heart.style.top = y + "%";

	const sway = Math.random() * 40 - 20 + "px";
	heart.style.setProperty("--sway", sway);

	heart.style.fontSize = Math.random() * 15 + 15 + "px";
	container.appendChild(heart);
	setTimeout(() => heart.remove(), 6000);
}

function createHeartExplosion(x, y) {
	const container = document.getElementById("heart-container");
	const particleCount = 18;
	for (let i = 0; i < particleCount; i++) {
		const heart = document.createElement("span");
		heart.className =
			"material-symbols-outlined heart-particle text-secondary material-symbols-fill";
		heart.innerText = "favorite";
		heart.style.left = `${x}%`;
		heart.style.top = `${y}%`;
		const angle = Math.random() * Math.PI * 2;
		const distance = Math.random() * 150 + 60;
		const tx = Math.cos(angle) * distance;
		const ty = Math.sin(angle) * distance;
		const size = Math.random() * 16 + 12;
		heart.style.fontSize = `${size}px`;
		heart.style.setProperty("--tx", `${tx}px`);
		heart.style.setProperty("--ty", `${ty}px`);
		heart.style.setProperty("--scale-end", `${Math.random() * 0.4 + 0.3}`);
		container.appendChild(heart);
		setTimeout(() => heart.remove(), 1500);
	}
}

setInterval(() => {
	const authScreen = document.getElementById("auth-screen");
	const isAuthVisible = authScreen && authScreen.style.display !== "none";

	if (isAuthVisible) {
		createHeartAt(Math.random() * 100, 100);
	} else {
		const x = Math.random() * 100;
		const y = Math.random() * 70 + 30;
		createHeartAt(x, y);
	}
}, 2000);

document.getElementById("name-input").addEventListener("keypress", (e) => {
	if (e.key === "Enter") checkName();
});
document.getElementById("message-input").addEventListener("keypress", (e) => {
	if (e.key === "Enter") postMessage();
});

document.addEventListener("keydown", (e) => {
	if (e.key === "Escape") {
		const modal = document.getElementById("custom-modal");
		if (modal.classList.contains("active")) {
			closeModal(false);
		}
	}
});

document.addEventListener("mousedown", (e) => {
	const menu = document.getElementById("mobile-menu");
	const trigger = document.getElementById("mobile-menu-trigger");
	const modal = document.getElementById("custom-modal");
	const typeModal = document.getElementById("type-modal");

	if (menu && menu.classList.contains("active")) {
		if (!menu.contains(e.target) && !trigger.contains(e.target)) {
			toggleMenu();
		}
	}

	if (modal && modal.classList.contains("active")) {
		const card = modal.querySelector(".modal-card");
		if (!card.contains(e.target)) {
			closeModal(false);
		}
	}

	if (typeModal && typeModal.classList.contains("active")) {
		const card = typeModal.querySelector(".modal-card");
		if (!card.contains(e.target)) {
			closeTypeModal(null);
		}
	}

	if (
		e.target.tagName === "INPUT" ||
		e.target.tagName === "BUTTON" ||
		e.target.closest("button")
	)
		return;

	const count = 6;
	const container = document.getElementById("heart-container");

	for (let i = 0; i < count; i++) {
		const heart = document.createElement("span");
		heart.className =
			"material-symbols-outlined heart-particle text-secondary material-symbols-fill";
		heart.innerText = "favorite";

		heart.style.position = "fixed";
		heart.style.left = e.clientX + "px";
		heart.style.top = e.clientY + "px";

		const angle = Math.random() * Math.PI * 2;
		const distance = Math.random() * 60 + 30;
		const tx = Math.cos(angle) * distance;
		const ty = Math.sin(angle) * distance;

		const size = Math.random() * 12 + 10;
		heart.style.fontSize = `${size}px`;
		heart.style.setProperty("--tx", `${tx}px`);
		heart.style.setProperty("--ty", `${ty}px`);
		heart.style.setProperty("--scale-end", "0");

		container.appendChild(heart);
		setTimeout(() => heart.remove(), 1000);
	}
});
