import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
	process.env.SUPABASE_URL,
	process.env.SUPABASE_ANON_KEY,
);

export default async function handler(req, res) {
	if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
		return res
			.status(500)
			.json({ error: "Supabase environment variables are missing" });
	}

	if (req.method === "GET") {
		const { boardId } = req.query;
		if (!boardId) return res.status(400).json({ error: "boardId required" });

		const { data, error } = await supabase
			.from("messages")
			.select("*")
			.eq("board_id", boardId)
			.order("created_at", { ascending: true });

		if (error) return res.status(500).json({ error: error.message });
		return res.status(200).json(data);
	}

	if (req.method === "PATCH") {
		const { id, x, y, rotation, liked } = req.body;
		if (!id) return res.status(400).json({ error: "id required" });

		const updates = {};
		if (x !== undefined) updates.x = x;
		if (y !== undefined) updates.y = y;
		if (rotation !== undefined) updates.rotation = rotation;
		if (liked !== undefined) updates.liked = liked;

		const { data, error } = await supabase
			.from("messages")
			.update(updates)
			.eq("id", id)
			.select();

		if (error) return res.status(500).json({ error: error.message });
		return res.status(200).json(data[0]);
	}

	if (req.method === "DELETE") {
		const { id, boardId } = req.body;

		if (id) {
			const { error } = await supabase.from("messages").delete().eq("id", id);
			if (error) return res.status(500).json({ error: error.message });
			return res.status(200).json({ success: true });
		}

		if (boardId) {
			const { error } = await supabase
				.from("messages")
				.delete()
				.eq("board_id", boardId);
			if (error) return res.status(500).json({ error: error.message });
			return res.status(200).json({ success: true });
		}

		return res.status(400).json({ error: "id or boardId required" });
	}

	res.status(405).json({ error: "Method not allowed" });
}
