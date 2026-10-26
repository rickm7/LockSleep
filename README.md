# LockSleep 2

App desktop Windows per il monitoraggio del sonno tramite webcam.

## Avvio su un altro PC

1. Installa [Node.js LTS](https://nodejs.org/) (include npm).
2. Scarica il progetto da **Code → Download ZIP** oppure esegui `git clone https://github.com/rickm7/LockSleep.git`.
3. Estrai lo ZIP e fai doppio clic su `Avvia_LockSleep.bat`.

Lo script avvia LockSleep con Electron. Dopo che le dipendenze sono installate, l'applicazione funziona in locale senza Chrome e senza connessione Internet: fotocamera, registrazione e galleria restano sul PC. Il primo `npm install` su un PC nuovo richiede invece Internet, a meno che `node_modules` sia già presente. In alternativa, usa `npm start`.

## Creare l'app Windows

Per creare la versione portatile Windows, con Node.js installato esegui `npm install` e poi `npm run build`. L'eseguibile senza installazione viene prodotto in `dist/`; quando avviato, conserva i dati nella cartella accanto all'eseguibile. Chi usa l'app non deve installare Node.js né Electron.

## Note

- La webcam va autorizzata in Windows se richiesto. LockSleep 2 conserva il database in `%APPDATA%\LockSleep 2`; i dati salvati da precedenti avvii in Chrome restano nel profilo Chrome e non vengono spostati copiando i file del progetto.
- `Registrazione_Rapida.bat` e `Stop_Rapido.bat` inviano i comandi alla stessa applicazione Electron.
- Non caricare `node_modules`: viene ricreato con `npm install`.
