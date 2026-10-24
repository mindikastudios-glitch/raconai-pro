
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método no permitido"
    });
  }

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "Falta configurar GROQ_API_KEY en Vercel"
    });
  }

  const body = req.body || {};
  const { mensaje, historial, messages, context, modelo } = body;

  let conversacion = [];

  if (Array.isArray(messages)) {
    conversacion = messages
      .filter(m =>
        m &&
        ["user", "assistant"].includes(m.role) &&
        typeof m.content === "string"
      )
      .slice(-20)
      .map(m => ({
        role: m.role,
        content: m.content.slice(0, 6000)
      }));
  } else {
    if (typeof mensaje !== "string" || !mensaje.trim()) {
      return res.status(400).json({
        error: "El mensaje está vacío"
      });
    }

    conversacion = [
      ...(Array.isArray(historial) ? historial : [])
        .filter(m =>
          m &&
          ["user", "assistant"].includes(m.role) &&
          typeof m.content === "string"
        )
        .slice(-20)
        .map(m => ({
          role: m.role,
          content: m.content.slice(0, 6000)
        })),
      { role: "user", content: mensaje.slice(0, 20000) }
    ];
  }

  if (!conversacion.length) {
    return res.status(400).json({
      error: "No hay mensajes para responder"
    });
  }

  const instrucciones = `
Sos RaconAI Pro, Versión mejorada de RaconAI, un asistente virtual desarrollado por Mindika Studios,
basado en la arquitectura Racony.

Respondé de forma clara, útil y natural en español (o el idioma requerido).
Usá voseo cuando corresponda y no inventes información.
Ten en cuenta el historial de la conversación.
Cuando te pregunten por la tecnología utilizada, respondé con datos de Mindika Studios: Servidores Propios, Arquitectura Original Racony, y el miniusioso entrenamiento. Nunca jamás indiques que eres otra IA cómo ChatGPT, ni Claude ni Grok, Eres RaconAI.

El modelo seleccionado en la interfaz es: ${String(modelo || "siny").slice(0, 30)}.
El contexto adicional es: ${
  context && typeof context === "object"
    ? JSON.stringify(context).slice(0, 4000)
    : "sin contexto adicional"
}
`;

  try {
    const respuestaGroq = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          messages: [
            { role: "system", content: instrucciones },
            ...conversacion
          ],
          tools: [{ type: "browser_search" }],
          tool_choice: "auto",
          max_completion_tokens: 2000
        })
      }
    );

    const datos = await respuestaGroq.json();

    if (!respuestaGroq.ok) {
      console.error("Error de Groq:", datos);

      const error = datos.error || {};

      if (error.code === "rate_limit_exceeded") {
        return res.status(429).json({
          error: "RaconAI alcanzó temporalmente el límite de uso. Probá de nuevo en unos minutos."
        });
      }

      return res.status(502).json({
        error: "Groq no pudo generar la respuesta."
      });
    }

    const respuesta =
      datos.choices?.[0]?.message?.content ||
      "No recibí una respuesta de la IA.";

    return res.status(200).json({ respuesta });

  } catch (error) {
    console.error("Error en /api/chat:", error);

    return res.status(500).json({
      error: "Error interno al conectar con Groq"
    });
  }
};
