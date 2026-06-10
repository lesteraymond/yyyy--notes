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
		const { data, error } = await supabase
			.from("boards")
			.select("*")
			.order("created_at", { ascending: true });
		if (error) return res.status(500).json({ error: error.message });
		return res.status(200).json(data);
	}

	if (req.method === "POST") {
		const { name, type } = req.body;
		const newId = Date.now();

		const { data, error } = await supabase
			.from("boards")
			.insert([{ id: newId, name: name || "New Page", type: type || "sticky" }])
			.select();

		if (error) return res.status(500).json({ error: error.message });

		if (!data || data.length === 0) {
			const { data: fetched, error: fetchError } = await supabase
				.from("boards")
				.select("*")
				.eq("id", newId)
				.single();
			if (fetchError || !fetched) {
				return res
					.status(500)
					.json({ error: "Insert succeeded but cannot fetch new board" });
			}
			return res.status(201).json(fetched);
		}

		return res.status(201).json(data[0]);
	}

	if (req.method === "DELETE") {
		const { id } = req.body;
		if (!id) return res.status(400).json({ error: "id required" });
		const { error } = await supabase.from("boards").delete().eq("id", id);
		if (error) return res.status(500).json({ error: error.message });
		return res.status(200).json({ success: true });
	}

	res.status(405).json({ error: "Method not allowed" });
}
