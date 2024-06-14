import express, { json } from "express";
const app = express();
import cors from "cors";
import { configure, preferences } from "mercadopago";
require("dotenv").config();

configure({
  access_token: process.env.ACCESS_TOKEN,
});

app.use(json());
app.use(cors());

app.get("/api/fercho", (req, res) => {
  res.send("todo ok");
});

app.post("/create_preference", (req, res) => {
  let preference = {
    items: req.body.items,
    back_urls: {
      success: "https://nueva-ap-pduje-vblc.vercel.app/checkout",
      failure: "https://nueva-ap-pduje-vblc.vercel.app/login",
      pending: "",
    },
    auto_return: "approved",
    shipments: {
      cost: req.body.shipment_cost,
      mode: "not_specified",
    },
  };

  preferences.create(preference).then(function (response) {
    res.json({
      id: response.body.id,
    });
  });
});

//
app.listen(8080, () => {
  console.log("servidor corriendo");
});
