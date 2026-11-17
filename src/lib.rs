use iroh::{
    Endpoint, EndpointId,
    endpoint::{Connection, presets::N0},
};
use wasm_bindgen::prelude::*;

const PROTOCOL: &[u8] = b"dont-cheat/1";
const LIMIT: usize = 16_384;

fn js(error: impl std::fmt::Display) -> JsError {
    JsError::new(&error.to_string())
}

#[wasm_bindgen]
pub struct Arena(Endpoint);

#[wasm_bindgen]
impl Arena {
    pub async fn start() -> Result<Arena, JsError> {
        let endpoint = Endpoint::builder(N0)
            .alpns(vec![PROTOCOL.to_vec()])
            .bind()
            .await
            .map_err(js)?;
        Ok(Arena(endpoint))
    }

    pub async fn invite(&self) -> String {
        self.0.online().await;
        self.0.id().to_string()
    }

    pub async fn accept(&self) -> Result<Link, JsError> {
        let incoming = self
            .0
            .accept()
            .await
            .ok_or_else(|| JsError::new("Room closed"))?;
        Ok(Link(incoming.await.map_err(js)?))
    }

    pub async fn dial(&self, id: String) -> Result<Link, JsError> {
        let id = id.parse::<EndpointId>().map_err(js)?;
        Ok(Link(self.0.connect(id, PROTOCOL).await.map_err(js)?))
    }

    pub async fn close(&self) {
        self.0.close().await;
    }
}

#[wasm_bindgen]
pub struct Link(Connection);

#[wasm_bindgen]
impl Link {
    pub async fn send(&self, message: String) -> Result<(), JsError> {
        if message.len() > LIMIT {
            return Err(JsError::new("Message too large"));
        }
        let mut stream = self.0.open_uni().await.map_err(js)?;
        stream.write_all(message.as_bytes()).await.map_err(js)?;
        stream.finish().map_err(js)?;
        Ok(())
    }

    pub async fn receive(&self) -> Result<String, JsError> {
        let mut stream = self.0.accept_uni().await.map_err(js)?;
        String::from_utf8(stream.read_to_end(LIMIT).await.map_err(js)?).map_err(js)
    }

    pub fn close(&self) {
        self.0.close(0u8.into(), b"Left arena");
    }
}
