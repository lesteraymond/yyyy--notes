import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
	process.env.SUPABASE_URL,
	process.env.SUPABASE_ANON_KEY,
);

export default async function handler(req, res) {
	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	const { name } = req.body;
	if (!name) {
		return res.status(400).json({ error: "Name is required" });
	}

	const { data, error } = await supabase
		.from("users")
		.select("name")
		.eq("name", name.toLowerCase().trim())
		.maybeSingle();

	if (error) {
		return res.status(500).json({ error: error.message });
	}

	if (data) {
		return res.status(200).json({ allowed: true, name: data.name });
	} else {
		return res.status(200).json({ allowed: false });
	}
}
