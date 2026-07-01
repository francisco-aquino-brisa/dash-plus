// Minimal stand-in for the Brisanet SSO, used ONLY to test the local
// login/logout flow end-to-end without real credentials. Mimics:
//   GET  /auth/steps?login={cpf}
//   POST /auth/login
import http from "node:http";

const PORT = Number(process.argv[2] || 4555);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  res.setHeader("Content-Type", "application/json");

  if (req.method === "GET" && url.pathname === "/auth/steps") {
    res.end(
      JSON.stringify({
        name: "Usuário De Teste",
        picture: "853.png",
        otp: false,
        captcha: false,
      }),
    );
    return;
  }

  if (req.method === "POST" && url.pathname === "/auth/login") {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = JSON.parse(raw || "{}");
      // Accept any password except the literal "wrong" (lets us test both paths).
      if (body.password === "wrong") {
        res.statusCode = 401;
        res.end(JSON.stringify({ message: "Credenciais inválidas" }));
        return;
      }
      res.end(
        JSON.stringify({
          id: 853,
          picture: "853.png",
          username: body.username,
          name: "Usuário De Teste",
        }),
      );
    });
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(PORT, () => console.log(`stub-sso listening on ${PORT}`));
