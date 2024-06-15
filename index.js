const express = require("express");
const app = express();
const cors = require("cors");
const mercadopago = require("mercadopago");
require("dotenv").config();

mercadopago.configure({
  access_token: process.env.ACCESS_TOKEN,
});

app.use(express.json());
app.use(cors());

app.get("/api/fercho", (req, res) => {
  res.send("todo ok");
});

app.post("/create_preference", (req, res) => {
  let preference = {
    items: req.body.items,
    back_urls: {
      success: "https://mp.atlantics.dev/checkout",
      failure: "https://mp.atlantics.dev/login",
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
