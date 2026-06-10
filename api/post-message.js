// import { createClient } from "@supabase/supabase-js";

// const supabase = createClient(
// 	process.env.SUPABASE_URL,
// 	process.env.SUPABASE_ANON_KEY,
// );

// export default async function handler(req, res) {
// 	if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
// 		return res
// 			.status(500)
// 			.json({ error: "Supabase environment variables are missing" });
// 	}

// 	if (req.method !== "POST") {
// 		return res.status(405).json({ error: "Method not allowed" });
// 	}

// 	const { board_id, text, time, x, y, rotation } = req.body;
// 	if (!board_id || !text) {
// 		return res.status(400).json({ error: "board_id and text required" });
// 	}

// 	const { data, error } = await supabase
// 		.from("messages")
// 		.insert([
// 			{
// 				board_id,
// 				text,
// 				time,
// 				x,
// 				y,
// 				rotation,
// 				liked: false,
// 			},
// 		])
// 		.select();

// 	if (error) return res.status(500).json({ error: error.message });
// 	return res.status(201).json(data[0]);
// }

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

	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	const { board_id, text, time, x, y, rotation, mood_type, mood_artist, mood_title, mood_lyrics } = req.body;
	if (!board_id) {
		return res.status(400).json({ error: "board_id required" });
	}

	// Require either text or at least some mood title/lyrics
	if (!text && !mood_title && !mood_lyrics) {
		return res.status(400).json({ error: "Message text or mood details required" });
	}

	const newId = Date.now();

	const { data, error } = await supabase
		.from("messages")
		.insert([
			{
				id: newId,
				board_id,
				text,
				time,
				x,
				y,
				rotation: rotation || 0,
				liked: false,
				mood_type,
				mood_artist,
				mood_title,
				mood_lyrics,
			},
		])
		.select();

	if (error) {
		console.error("Supabase insert error:", error);
		return res.status(500).json({ error: error.message });
	}

	if (!data || data.length === 0) {
		return res
			.status(500)
			.json({ error: "Insert succeeded but no data returned" });
	}

	return res.status(201).json(data[0]);
}
