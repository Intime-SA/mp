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

// Ruta para autenticarse y obtener el token
let authToken = "";

// Ruta para autenticarse y obtener el token
app.post("/authenticate", async (req, res) => {
  // Leer email y password desde las variables de entorno
  const email = process.env.GOCUOTAS_EMAIL;
  const password = process.env.GOCUOTAS_PASSWORD;

  if (!email || !password) {
    return res
      .status(500)
      .json({ error: "Server misconfiguration: Missing credentials." });
  }

  try {
    // Realizar la autenticación con el servicio GoCuotas
    const response = await axios.post(
      `https://www.gocuotas.com/api_redirect/v1/authentication?email=${encodeURIComponent(
        email
      )}&password=${encodeURIComponent(password)}`
    );

    // Guardar el token de autenticación sin enviarlo al cliente
    authToken = response.data.token;
    console.log("Token:", authToken); // Solo para depuración, puede ser eliminado en producción

    // Enviar respuesta de éxito sin el token
    res.status(200).json({ message: "Authenticated GO CUOTAS successfully." });
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
  console.log(req.body, 'req.body');
  let preference = {
    items: req.body.items,
    back_urls: {
      success: "https://test.mayoristakaurymdp.com/checkout-success-mp",
      failure: "https://test.mayoristakaurymdp.com/checkout-failure",
      pending: ""
    },
    auto_return: "approved",
    shipments: {
      cost: req.body.shipment_cost,
      mode: "not_specified",
    },
    external_reference: req.body.external_reference,
    notification_url: process.env.MP_WEBHOOK_URL,
  };

  console.log("Preference a crear:", JSON.stringify(preference, null, 2));

  mercadopago.preferences.create(preference)
    .then(function (response) {
      console.log("Respuesta de MercadoPago:", response.body);
      res.json({
        id: response.body.id,
      });
    })
    .catch(error => {
      console.error("Error al crear preferencia:", error);
      res.status(500).json({ error: error.message });
    });
});

// Webhook específico para MercadoPago
app.post("/mp-webhook", async (req, res) => {
  try {
    const { type, data } = req.body;
    
    console.log("Webhook MP recibido:", { type, data });

    if (type === "payment") {
      const paymentId = data.id;
      
      // Obtener información del pago
      const payment = await mercadopago.payment.findById(paymentId);
      console.log("Información del pago MP:", payment.body);

      // Preparar la información del pago para enviar a tu API backend
      const paymentInfo = {
        dateTimePayment: new Date(),
        paymentId: paymentId,
        statusPayment: payment.body.status,
        orderReference: payment.body.external_reference,
        amount: payment.body.transaction_amount
      };

      // Enviar la información a tu API backend
      try {
        console.log(process.env.BACKEND_API_URL + '/payments/register', 'process.env.BACKEND_API_URL');
        const backendResponse = await axios.post(
          process.env.BACKEND_API_URL + '/payments/register',
          paymentInfo
        );
        console.log("Respuesta del backend:", backendResponse.data);
      } catch (backendError) {
        console.error("Error al enviar información al backend:", backendError);
        // Aquí podrías implementar un sistema de reintentos si es necesario
      }

      // Aquí puedes manejar los diferentes estados del pago
      switch (payment.body.status) {
        case "approved":
          console.log("Pago MP aprobado");
          break;
        case "rejected":
          console.log("Pago MP rechazado");
          break;
        case "pending":
          console.log("Pago MP pendiente");
          break;
        default:
          console.log("Estado no manejado:", payment.body.status);
      }
    }

    // Siempre responder con 200 para que MercadoPago sepa que recibimos la notificación
    res.status(200).send("OK");
  } catch (error) {
    console.error("Error en webhook MP:", error);
    res.status(500).send("Error");
  }
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
