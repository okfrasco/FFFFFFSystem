# Sistema generativo — Catalogo nodi

Sep 30, 2026 · @Francesco

## Principi

Ogni nodo rispetta un unico contratto, il grafo trasporta quattro tipi di segnale e qualsiasi parametro di qualsiasi nodo accetta un segnale di controllo.

| Tipo | Cosa trasporta | Frequenza |
| --- | --- | --- |
| Fase | Rampa 0→1 che scorre: il tempo, piegabile | Controllo o audio |
| Controllo | Valori 0–1 o bipolari, gate, trigger, eventi nota (pitch + velocity) | Controllo |
| Audio | Segnale sonoro | Sample rate |
| Texture | Immagine su GPU | Frame rate |

**Contratto del modulo** (manifest):

- id, nome, categoria
- porte tipizzate in ingresso e in uscita
- parametri con range, curva e tipo: continuo (si interpola) o discreto (si morpha in modo probabilistico)
- seed e stato serializzabile, così le scene possono salvarlo e morpharlo
- funzione `process` chiamata dall'host al proprio rate

**Dettagli del contratto (v0)** — la forma in codice è `src/core/types.ts`:

- **Fase srotolata**: una porta di fase porta, per ogni tick, il valore all'inizio e alla fine del tick (float64 che non si avvolge). Parte intera = ciclo, parte frazionaria = rampa 0→1. Dentro il tick la fase è lineare, quindi l'istante esatto di uno step si ricava per interpolazione: gli eventi hanno timestamp più fini del tick di controllo. Tra un tick e l'altro la fase può saltare (Ø Scale che cambia rapporto alla battuta, Ø Reset): i nodi guardano solo l'intervallo [inizio, fine) del tick, così un salto non produce raffiche di step.
- **Buffer di controllo**: valori per voce alla fine del tick più una lista di eventi con tempo assoluto sul clock dell'AudioContext: `trig` (velocity, e facoltativamente un `value` portato nello stesso istante, es. il grado scelto da Markov), `gate` (fronte on/off), `note` (pitch, velocity, durata). Le porte di controllo dichiarano un sottotipo `signal`: `value`, `gate` o `event`.
- **Contesto di processo**: `t0`/`t1`/`dt` del tick, contatore, RNG del nodo, `param(id, voce)` per il valore effettivo (base + modulazione + morph) e `discrete(id, chiaveEvento, voce)` per i parametri discreti. La chiave identifica l'evento in modo stabile, così durante un morph probabilistico ogni evento ha una soglia fissa: segue B quando il progresso la supera, e una volta passato a B ci resta.
- **Config separata dai parametri**: ciò che non è un numero modulabile (regole dell'L-system, matrice di Markov, tabelle di Steps e Gates) sta nella `config` del nodo, salvata nella patch e nella scena, e si morpha come scelta discreta.
- **Rate del modulo**: `control` (tick dello scheduler nel main thread), `audio` (blocchi di 128 campioni nell'AudioWorklet, con `sampleRate` e `frames` nel contesto) o `frame` (render dei visual, con il contesto WebGL).
- **Visual**: i nodi a rate `frame` girano in un grafo a parte, a ogni frame, con il contesto WebGL2. Il controllo è calcolato in anticipo (lookahead), quindi ogni cavo da un nodo di controllo o di fase verso un nodo visual diventa una "sonda" che legge la Timeline all'istante che si sta sentendo (clock audio meno la latenza d'uscita): immagine e suono coincidono. Le velocità dei nodi visual sono al secondo, non per frame.
- **Analisi (audio → controllo)**: le uscite di controllo dei nodi audio (es. Envelope follower) modulano i nodi audio direttamente nel worklet, senza latenza; tornano al main ogni ~10 ms con il tempo reale di misura, per i nodi di controllo (che le leggono al tick successivo) e per i visual (che le leggono all'istante mostrato).
- **Audio**: la patch si divide tra main e worklet. I cavi da un nodo di controllo a un nodo audio diventano "ponti": il main manda in anticipo (lookahead) i buffer di ogni tick e il worklet li consegna al blocco giusto, con ogni evento al suo campione. Più cavi audio sullo stesso ingresso si sommano. I segnali audio sono mono per voce; uno stereo è un segnale a 2 voci (sinistra, destra). I moduli audio allocano le loro memorie al primo process, perché nel main vengono istanziati solo per l'editor.
- **Tabelle e fase**: Gates e Steps stendono l'intera tabella su un ciclo della fase che li legge (5 valori su una battuta = quintine); per cambiare la durata degli step si piega la fase, non la tabella.
- **Patch e editor**: la patch JSON è la fonte di verità; ogni nodo può avere una posizione `ui` per l'editor (non tocca il suono). Una modifica strutturale ricostruisce il grafo riusando istanza, RNG e buffer dei nodi con stesso id, modulo e seed, quindi si modifica mentre suona senza azzerare memorie e catene. I cambi di parametro e di config vanno al volo, senza ricostruire.
- **Markov**: la matrice è fatta di parametri (fino a 12 stati: celle m{i}_{j}, valori v{i}, attrazioni a{j}), quindi ogni cella si modula con un cavo e si morpha con le scene. L'attrazione moltiplica una colonna: modularla tira la catena verso quello stato.
- **Scene e morph**: una scena (salvata nella patch, `scenes`) è l'istantanea di parametri, seed e config di ogni nodo, più stato interno e RNG dei nodi di controllo; si richiama con un taglio netto, con o senza stato, e non tocca la struttura. Il morph A→B ha un progresso a mano o in N battute del Transport, con curva (lin, smooth, in, out). Continui: interpolati nello spazio normalizzato. Discreti dei nodi di controllo: per evento, con soglia fissa hash(seed, parametro, evento). Discreti di audio e visual e config: ogni parametro o nodo cambia alla sua soglia fissa. Seed: un'istanza ombra con il seed di B gira in parallelo dallo stato attuale e le uscite si mescolano (ogni evento ha una soglia fissa); a fine morph l'ombra diventa il nodo. Le soglie fisse rendono il morph monotono e riproducibile.
- **Seed**: ogni nodo ha un seed; quelli non esplicitati derivano dal seed globale della patch. Lo stato dell'RNG è serializzabile e fa parte della scena.

**Parametri standard dei generatori**, lo stesso linguaggio per tutti: Seed, Mutazione (familiarità ↔ novità), Swing, e la fase in ingresso al posto di un rate interno.

**Polifonia su ogni cavo**, come poly\~ e mc in Max: qualsiasi segnale può portare N voci, e ogni voce conosce il proprio indice. Un parametro può quindi avere un valore diverso per ogni voce.

**Dove gira ogni tipo**: fase e controllo in TypeScript, audio nativo (AudioWorklet per prototipare), texture in GLSL.

&#91;embedded content: architettura · quattro tipi di segnale dentro lo strato scene\]

La fase alimenta il controllo, il controllo pilota audio e texture, i convertitori riportano l'analisi al controllo; le scene avvolgono tutto.

## Fase e clock

Il tempo è una fase che scorre, come in Bitwig Grid: tutti i generatori la leggono, e piegarla cambia il groove di tutto ciò che ne dipende.

| Nodo | Cosa fa |
| --- | --- |
| Transport | Fase sincronizzata alla DAW, in battute o beat |
| Phasor | Fase libera in Hz, per tempi non allineati |
| Step Access | Fase ancorata alla battuta 1, riparte sempre dallo stesso punto |
| Ø Scale | Accelera o rallenta per rapporto (×2, ÷3, 3:4) |
| Ø Ratio | Più fasi in rapporti n:m, per poliritmi e polimetri |
| Ø Split | Una fase in N uscite sfasate |
| Ø Bend / Ø Pinch | Curva o S-curve sulla fase: accelerando e rallentando dentro il ciclo |
| Ø Swing | Sposta gli step pari, con quantità e risoluzione |
| Ø Reset | Riporta la fase a 0 su trigger |
| Ø Reverse / Ø Mirror | Fase al contrario o riflessa |
| Ø Shift | Offset di fase, per sfasare copie dello stesso pattern |
| Ø Wrap | Porta qualsiasi segnale nel range 0–1 |
| Ø Counter | Trasforma trigger successivi in fase a scalini |
| Ø Drift | Jitter lento e continuo, per un tempo che respira |

## Generatori di controllo

I generatori producono gate, valori ed eventi a partire dalla fase; tutti hanno Seed e Mutazione, e il genere è un parametro morphabile, non un preset.

**Ritmici**

| Nodo | Cosa fa |
| --- | --- |
| Euclideo | Distribuisce K impulsi su N step, con rotazione |
| Euclideo multistrato | Più euclidei annidati: accenti, ghost note, fill |
| Cicli | N cicli di lunghezze diverse che si riallineano raramente |
| Burst | Una raffica di trigger da un solo gate |
| Ratchet | Ripetizioni dentro lo step, con probabilità |
| Spark | Trigger casuali: divisore + probabilità in un knob |
| Setaccio | Sieve alla Xenakis: unioni e intersezioni di moduli numerici |
| Cadenza | multiple (unità in sedicesimi) × bar length = size; un colpo ogni `cadence` sedicesimi, conteggio che riparte alla size; pitch, length e velocity letti a ogni colpo |

**Algoritmici**

| Nodo | Cosa fa |
| --- | --- |
| L-system | Assioma + regole + iterazioni; i simboli diventano eventi, pitch o gesti |
| Automa 1D | Regola di Wolfram: ogni generazione è uno step o una riga |
| Game of Life | Griglia 2D letta come pattern; condivisibile con i visual |
| Markov | Catene di ordine N, matrice editabile o appresa dai tuoi MIDI |
| Random walk | Passi casuali con limiti e attrazione verso un centro |
| Turing Machine | Shift register con probabilità di bloccare o mutare il loop |
| Mappa logistica | Da stabile a caotico con un solo parametro |
| Attrattore | Lorenz e simili: tre uscite continue correlate |
| Serie infinita | Serie autosimile alla Nørgård, melodie che contengono se stesse |
| Sequenza numerica | Fibonacci, primi, serie custom mappate a eventi |

**Stile e genere**

| Nodo | Cosa fa |
| --- | --- |
| Rhythm | Kit per genere (kick, snare, hat, perc) con velocity |
| Pattern | Linee pitched per genere, per bassi e lead |
| Motif | Celle melodiche con ripetizione e variazione |
| Acid | Pattern alla 303 con slide e accent |
| Style Blend | Miscela di grammatiche di genere (es. 70% jungle, 30% bossa), morphabile |

**Continui**

| Nodo | Cosa fa |
| --- | --- |
| LFO | Forme base, sincronizzato alla fase |
| LFO aliasato | Triangolo campionato a step (t · pattern/100 che rimbalza tra 0 e 1): figure ripetitive o caotiche a seconda del pattern; la profondità è l'amount del cavo |
| Curve | Forma disegnabile letta dalla fase |
| S&H Random | Valori casuali a scalini o smussati |
| Noise | Perlin 1D e rumore colorato, lento o veloce |

## Groove e microtempo

Il groove wonky vive tra le griglie: eventi che stanno a metà tra sedicesimi e terzine, voci che anticipano o ritardano in modo diverso. Nel sistema a fase lo swing è semplicemente una fase piegata dentro ogni beat, quindi tutti questi nodi sono modulabili e morphabili.

| Nodo | Cosa fa |
| --- | --- |
| Swing continuo | Swing con curva per step, su 8vi o 16mi, anche negativo |
| Grid Blend | Interpola la posizione degli eventi tra due griglie (dritta ↔ terzina ↔ quintina) |
| Tupla | Griglie a 5, 7, 9 contro il 4, con swing proprio |
| Offset per voce | Anticipo o ritardo per voce (kick avanti, snare dietro, hat che corre) |
| Groove template | Tabella di micro-offset per step, disegnata o estratta da un loop o un MIDI |
| Snare displacement | Sposta il backbeat di ±1/16 o ±1/32, fisso o con probabilità |
| Griglia polimetrica | Corsie con lunghezze e suddivisioni diverse sotto lo stesso tempo |
| Drift correlato | Micro-deriva continua e coerente nel tempo, non un random per nota |
| Accento → ritardo | Lega l'offset alla velocity: le note forti cadono più indietro |
| Flam / Ghost | Genera flam e ghost note attorno ai colpi principali |

Con la polifonia, il groove template può essere una tabella immagine: una riga di micro-offset per voce.

## Dati e lookup

I nodi dati non hanno un tempo proprio: sono tabelle lette dalla fase, quindi la stessa sequenza cambia carattere se pieghi la fase che la legge.

| Nodo | Cosa fa |
| --- | --- |
| Steps | Sequenza di valori |
| Gates | Sequenza di gate on/off |
| Accents | Tre stati per step: off, normale, accento |
| Pitches | Sequenza di note |
| Probabilities | Probabilità di scatto per step |
| Slopes | Segmenti disegnabili |
| Array | Tabella registrabile al volo da qualsiasi segnale |
| Tabella 2D | Matrice letta da due fasi (X e Y) |
| MIDI Clip | Legge un file MIDI con la fase, quindi anche piegato o al contrario |

## Logica e trigger

La logica è il collante tra generatori: incrociare due pattern semplici con AND o XOR dà ritmi che nessuno dei due produce da solo.

| Nodo | Cosa fa |
| --- | --- |
| AND · OR · XOR · NOT · NAND · NOR | Porte logiche su gate |
| Comparatori (= ≠ > < ≥ ≤) | Gate quando un segnale supera o eguaglia un altro |
| Latch | Alterna o fissa uno stato a ogni trigger |
| N-Latch | Cicla tra N stati |
| Clock Divide / Multiply | Un trigger ogni N, o N trigger per impulso |
| Clock Quantize | Trattiene un trigger fino al prossimo impulso di clock |
| Gate Length | Impulso di durata fissa |
| Gate Repeat | Ripete impulsi finché l'ingresso è alto |
| Logic Delay | Ritarda l'apertura o la chiusura del gate |
| Coin Flip | Probabilità che smista i trigger verso A o B |
| Counter | Conta i trigger e scatta a una soglia |
| Shift Register | Memoria seriale a N uscite |
| Condizione | Scatta ogni N cicli, solo al primo, solo se il precedente è scattato (alla Elektron) |
| Router | Manda il segnale alla prossima uscita a ogni trigger |

## Trasformazioni di controllo

Qui stanno i due nodi che distinguono il sistema da un sequencer: Memoria, che ripete mutando invece di loopare, e Accoppiamento, che fa ascoltare i processi tra loro.

**Nodi chiave**

| Nodo | Cosa fa |
| --- | --- |
| Memoria | Ricorda gli ultimi N eventi e li ripete con una quantità di mutazione |
| Accoppiamento | Sincronizza fasi e accenti tra nodi, da indipendenti a fusi (modello alla Kuramoto) |
| Densità | Toglie o aggiunge eventi mantenendo quelli più forti |
| Humanize | Micro-spostamenti di tempo e velocity |

**Utility**

| Nodo | Cosa fa |
| --- | --- |
| Math | Somma, prodotto, differenza, min, max, media |
| Scale / Offset / Invert | Riscala, sposta, inverte |
| Quantize | Riduce il segnale a scalini |
| Curve | Rimappa ingresso → uscita con una curva disegnabile |
| Lag | Slew con salita e discesa separate |
| Sample & Hold | Congela il valore su trigger |
| Fold / Wrap | Ripiega o avvolge oltre i limiti |
| Blend | Crossfade tra due segnali |
| Mod Mixer | Somma pesata di più modulazioni |
| Echo | Ritarda eventi e valori, con feedback |

## Armonia e pitch

L'armonia è un campo condiviso: un nodo decide lo stato armonico corrente e tutti i nodi pitched ci si quantizzano sopra, così i tuoi sistemi armonici entrano come moduli.

| Nodo | Cosa fa |
| --- | --- |
| Campo armonico | Stato armonico globale (scala, accordo, basso) letto da tutti |
| Quantize a scala | Scale, modi, scale custom, oppure le note dell'accordo corrente |
| Sus Slash | Il tuo motore: sus + basso, alterazioni della quinta, brightness sul cerchio delle quinte |
| Accordi | Genera accordi da grado, tipo ed estensioni |
| Voice leading | Sceglie il voicing più vicino al precedente |
| Tonnetz | Cammina con trasformazioni P, L, R |
| Cerchio delle quinte | Cammina per quinte, a passi o per brightness |
| Tensione | Macro che sposta verso alterazioni e voicing più tesi |
| Arp | Da accordo a pattern, letto dalla fase |
| Strum | Sgrana gli accordi nel tempo |
| Transpose / Octave | Traspone per semitoni, gradi od ottave |
| Tuning | Microtonalità da file Scala o rapporti custom |

## Audio

Nella prima versione l'audio può restare nella DAW via MIDI; questi nodi servono quando il sistema suona da solo o in standalone.

**Generatori**

| Nodo | Cosa fa |
| --- | --- |
| Oscillatore | Forme base, sync, PWM |
| Wavetable | Scansione di tavole, anche da file |
| FM | Operatori con feedback |
| Phase Distortion | Distorsione della fase, alla Casio CZ |
| Additivo | Parziali controllabili una per una |
| Modale | Banchi di risonatori, fisico-modellato |
| Karplus-Strong | Corde pizzicate e percussioni |
| Granulare | Nuvole di grani da campione o ingresso live |
| Sampler / Slicer | Campioni e loop affettati per evento |
| Drum voice | Kick, snare, hat sintetici |
| Noise | Bianco, rosa, crackle |

**Effetti**

| Nodo | Cosa fa |
| --- | --- |
| Filtri | SVF, ladder, comb, formant, low-pass gate |
| Shaper | Wavefold, saturazione, Chebyshev |
| Delay | Tempo sincronizzato, feedback, modulazione |
| Reverb | Plate, FDN, freeze |
| Freq / Pitch Shift | Spostamento in Hz o semitoni, spirali in feedback |
| Buffer | Stutter, repeat, tape stop, reverse |
| Spettrale | Filtro FFT, freeze, smear |
| Dinamica | Compressore, duck, limiter |
| Mixer / VCA / Pan | Somma, livelli, stereo |

## Visual

Ogni nodo visual è uno shader GLSL con i parametri esposti come porte di controllo; la fase entra come uniform, quindi immagine e musica condividono lo stesso tempo.

**Generatori**

| Nodo | Cosa fa |
| --- | --- |
| SDF | Forme 2D e 3D in raymarching, combinabili |
| Noise field | Perlin, simplex, fbm, domain warping |
| Particelle | Sistemi di particelle guidati da forze e campi |
| Flow field | Linee che seguono un campo vettoriale |
| Reaction-diffusion | Pattern organici alla Gray-Scott |
| Automa texture | Game of Life o automi 1D disegnati come immagine |
| L-system geometry | Il turtle dell'L-system disegnato come struttura |
| Pattern | Griglie, ripetizioni, moiré |
| Scope | Audio come geometria, oscilloscopio XY |
| Tipografia | Testo come forma o maschera |
| Ingresso | Immagine, video, camera, Syphon/NDI in entrata |

**Effetti**

| Nodo | Cosa fa |
| --- | --- |
| Feedback | Il frame precedente rientra trasformato |
| Displace | Sposta i pixel secondo un'altra texture |
| Transform | Scala, ruota, tile, specchio, kaleido |
| Colore | Palette map, hue, livelli, posterize, threshold |
| Blur / Bloom | Sfocature e bagliori |
| Edge | Contorni e linee |
| Glitch | Datamosh, pixel sort, slit-scan, RGB shift |
| Time echo | Buffer di frame: ritardi e scie temporali |
| Composite | Metodi di fusione tra texture |
| Mask | Una texture ritaglia un'altra |

## Convertitori e analisi

I convertitori chiudono il cerchio: il suono modula l'immagine e l'immagine può rimodulare il suono, ed è lì che il sistema diventa un ecosistema.

| Nodo | Da → a | Cosa estrae |
| --- | --- | --- |
| Envelope follower | Audio → controllo | Inviluppo di ampiezza |
| Onset | Audio → controllo | Trigger sui transienti |
| Pitch tracker | Audio → controllo | Altezza e confidenza |
| Bande | Audio → controllo | Energia per banda, centroide spettrale |
| Luminosità | Texture → controllo | Luminosità media o di una zona |
| Movimento | Texture → controllo | Quantità di movimento tra frame |
| Colore | Texture → controllo | Colore dominante, saturazione |
| Pixel probe | Texture → controllo | Valore di un punto, spostabile |
| Uniform | Controllo → texture | Qualsiasi valore dentro uno shader |
| CV audio | Controllo → audio | Controllo a frequenza audio |
| Note out / in | Controllo ↔ MIDI | Eventi da e verso MIDI |

## Voci e tabelle dati

Qualsiasi immagine è una tabella: una riga per voce, una colonna per step, e i canali colore sono parametri diversi. Così una texture diventa N voci che leggono lo stesso parametro con valori diversi.

| Nodo | Cosa fa |
| --- | --- |
| Tabella immagine | Carica un'immagine e la legge come dati: righe = voci, colonne = tempo, RGB = tre parametri |
| Scroll | Scorre la tabella con la fase, in avanti o indietro, a velocità diversa per voce |
| Texture → tabella | Qualsiasi nodo visual diventa una tabella live |
| Spettro → tabella | Analizza l'audio in frequenza, ampiezza e fase per parziale e lo salva come immagine |
| Tabella → spettro | Risintetizza la tabella con un banco di oscillatori additivi |
| Voci | Crea N voci; ogni voce legge la propria riga |
| Spread | Distribuisce un valore sulle voci: lineare, a curva, casuale con seed |
| Voice Mix | Riduce le voci a una: somma, media, min, max, ultima |
| Voice Router | Manda ogni voce a un canale MIDI, un oscillatore o un'istanza di shader |

Il vantaggio è che gli effetti visual diventano modificatori di dati: un blur sulla tabella avvicina i valori delle voci, un displace le sfasa, un feedback le fa evolvere nel tempo.

## Scene, morph e arrangiamento

Una scena è lo snapshot di tutti i parametri e i seed del grafo; suonare significa muoversi tra scene, con un taglio netto o con un morph lungo decine di battute.

**Tre modi di morph**, scelti per tipo di parametro:

1. Continuo: i valori si interpolano (cutoff, densità, colore).
2. Probabilistico: le scelte discrete scattano per evento; a metà morph metà degli eventi segue A e metà B (step, regole, forme).
3. Seed: stessi parametri con seed diverso, in crossfade probabilistico tra le due versioni.

| Nodo | Cosa fa |
| --- | --- |
| Scena | Salva e richiama lo stato del grafo, o solo di un gruppo di nodi |
| Morph A→B | Transizione con durata in battute e curva |
| Morph XY | Pad con quattro scene agli angoli |
| Grafo di scene | Scene come nodi con probabilità di passaggio: arrangiamento generativo |
| Timeline | Sequenza di scene in battute con durata di morph, per i pezzi strutturati |
| Energia | Macro che spinge verso scene più dense o più vuote |
| Macro | Knob che muovono molti parametri insieme, con curve per destinazione |
| Muta scena | Crea una variante della scena corrente con quantità controllata |
| Registratore | Salva il percorso della performance e lo apre come Timeline modificabile |

## I/O e integrazione

L'host parla con il mondo esterno solo tramite questi nodi, così lo stesso grafo gira in browser, standalone o come plugin.

| Nodo | Cosa fa |
| --- | --- |
| MIDI Out | Eventi verso la DAW, su più canali e tracce |
| MIDI In | Note e CC in ingresso, anche per suonare sopra al sistema |
| Transport In | Tempo, play e posizione dalla DAW |
| OSC Out / In | Valori ed eventi verso e da TouchDesigner, Resolume, Max |
| Video Out | Syphon (Mac), Spout (Windows), NDI |
| Audio In / Out | Ingressi e uscite audio |
| Controller | MIDI learn verso parametri, macro e scene |
| Patch | Salva e carica grafo e scene come file JSON |

## Priorità per il prototipo v0

Il v0 serve a verificare una cosa sola: che fase condivisa, memoria e morph producano musica e immagini che cambiano senza sembrare un loop. Il sistema è autonomo: suona con i propri synth ed effetti, senza DAW. Bastano questi nodi, uno o due per categoria, dentro un editor a nodi.

- [x] Transport, Ø Scale, Ø Split
- [x] Euclideo, Markov (a matrice modulabile), L-system
- [x] Gates, Steps
- [x] AND, Coin Flip
- [x] Memoria, Accoppiamento
- [x] Quantize a scala
- [x] Editor a nodi: aggiungere moduli, cavi, modulazioni, editor dentro i nodi, patch in JSON
- [x] Audio: Voci, Oscillatore, Inviluppo, Filtro, VCA, Drum voice, Delay, Reverb, Mixer/Out
- [x] Cadenza, LFO aliasato
- [x] Noise field, Feedback, Colore (+ Schermo)
- [x] Envelope follower sull'audio interno
- [x] Scena, Morph A→B

MIDI In/Out restano nel catalogo, fuori dal v0.
