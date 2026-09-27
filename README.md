# LockSleep

App desktop Windows per il monitoraggio del sonno tramite webcam.

## Avvio su un altro PC

1. Installa [Node.js LTS](https://nodejs.org/) (include npm).
2. Scarica il progetto da **Code → Download ZIP** oppure esegui `git clone https://github.com/rickm7/LockSleep.git`.
3. Estrai lo ZIP e fai doppio clic su `Avvia_LockSleep.bat`.

Lo script installa le dipendenze la prima volta e avvia LockSleep con Electron. In alternativa, apri un terminale nella cartella e usa `npm install` seguito da `npm start`.

## Creare l'app Windows

Con Node.js installato, esegui `npm install` e poi `npm run build`. Il pacchetto prodotto si trova in `dist/`.

## Note

- La webcam va autorizzata in Windows se richiesto.
- `Registrazione_Rapida.bat` e `Stop_Rapido.bat` aprono la schermata corrispondente in Chrome/Edge quando disponibile.
- Non caricare `node_modules`: viene ricreato con `npm install`.
