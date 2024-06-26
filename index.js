const express = require("express");
const app = express();
const cors = require("cors");
const mercadopago = require("mercadopago");
const axios = require("axios");
require("dotenv").config();

mercadopago.configure({
  access_token: process.env.ACCESS_TOKEN,
});

app.use(express.json());
app.use(cors());
let authToken = "";

// Ruta para autenticarse y obtener el token
app.post("/authenticate", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Missing email or password" });
  }

  try {
    const response = await axios.post(
      `https://www.gocuotas.com/api_redirect/v1/authentication?email=${encodeURIComponent(
        email
      )}&password=${encodeURIComponent(password)}`
    );

    authToken = response.data.token;
    console.log("Token:", authToken);
    res.status(200).json({ token: authToken });
    return authToken;
  } catch (error) {
    console.error("Error authenticating:", error);
    res.status(500).json({ error: "Error authenticating" });
  }
});

// Ruta para iniciar el proceso de pago
app.post("/create-checkout", async (req, res) => {
  const {
    amount_in_cents,
    email,
    order_reference_id,
    phone_number,
    url_failure,
    url_success,
    webhook_url,
  } = req.body;

  // Verificar que todos los parámetros necesarios están presentes
  if (
    !amount_in_cents ||
    !email ||
    !order_reference_id ||
    !phone_number ||
    !url_failure ||
    !url_success
  ) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  try {
    // Realizar la petición POST al endpoint de checkout
    const response = await axios.post(
      "https://www.gocuotas.com/api_redirect/v1/checkouts",
      {
        amount_in_cents,
        email,
        order_reference_id,
        phone_number,
        url_failure,
        url_success,
        webhook_url,
      },
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    );
    console.log(response.data.url_init);
    res.json(response.data.url_init);
    return response.data.url_init;
  } catch (error) {
    // Manejar errores de la petición
    console.error("Error creating checkout:", error);
    res.status(500).json({ error: "Error creating checkout" });
  }
});

// Ruta para manejar el webhook de confirmación de pago
app.post("/webhook", (req, res) => {
  const { status, order_reference_id } = req.body;

  // Verificar que el webhook contiene los campos necesarios
  if (!status || !order_reference_id) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  // Manejar la lógica según el estado del pago
  if (status === "approved") {
    console.log(`Payment approved for order: ${order_reference_id}`);
    // Lógica para manejar pagos aprobados
  } else if (status === "denied") {
    console.log(`Payment denied for order: ${order_reference_id}`);
    // Lógica para manejar pagos denegados
  } else if (status === "undefined") {
    console.log(`Payment pending for order: ${order_reference_id}`);
    // Lógica para manejar pagos pendientes
  }

  // Responder con éxito al webhook
  res.status(200).send("Webhook received");
});

app.get("/api/fercho", (req, res) => {
  res.send("todo ok");
});

app.post("/create_preference", (req, res) => {
  let preference = {
    items: req.body.items,
    back_urls: {
      success: "https://mp.atlantics.dev/checkout",
      failure: "https://mp.atlantics.dev/checkout-failure",
      pending: "",
    },
    auto_return: "approved",
    shipments: {
      cost: req.body.shipment_cost,
      mode: "not_specified",
    },
  };

  mercadopago.preferences.create(preference).then(function (response) {
    res.json({
      id: response.body.id,
    });
  });
});

app.listen(8080, () => {
  console.log("servidor corriendo");
});
