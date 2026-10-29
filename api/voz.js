module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    return res.status(500).json({
      error: "Faltan las variables de entorno de ElevenLabs en Vercel."
    });
  }

  const texto = req.body?.texto;

  if (typeof texto !== "string" || !texto.trim()) {
    return res.status(400).json({ error: "No se recibió texto para convertir." });
  }

  if (texto.length > 5000) {
    return res.status(400).json({
      error: "El texto supera el límite de 5000 caracteres."
    });
  }

  try {
    const respuesta = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg"
        },
        body: JSON.stringify({
          text: texto,
          model_id: "eleven_multilingual_v2"
        })
      }
    );

    if (!respuesta.ok) {
      const detalle = await respuesta.text();
      console.error("Error de ElevenLabs:", respuesta.status, detalle);

      return res.status(502).json({
        error: "ElevenLabs no pudo generar el audio. Revisa tu configuración y los límites de tu cuenta."
      });
    }

    const audio = Buffer.from(await respuesta.arrayBuffer());

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(audio);
  } catch (error) {
    console.error("Error al generar la voz:", error);
    return res.status(500).json({
      error: "No se pudo generar el audio."
    });
  }
};
