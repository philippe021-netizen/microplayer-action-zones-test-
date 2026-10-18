# Gus — animations de Harmonie (préparation)

Branche dédiée : `feature/harmonie-gus-animations-20261018`. Ne pas fusionner dans `main` sans validation.

Les 10 paires de fichiers **WebP animé + M4A** ont été préparées à partir des 10 MP4 transmis le 18 octobre 2026, avec détourage et conservation des sons originaux. Le pack complet se trouve dans la bibliothèque ChatGPT, sous **Harmonie - devoirs et jeux / Gus - animations**, intitulé `Gus_20_fichiers_integration_site_2026-10-18.zip`.

**Important : les fichiers média binaires ne sont pas encore présents sur GitHub.** L'interface est branchée à `./gus_media/integration.js`, mais les clips doivent être placés dans ce répertoire pour qu'ils soient visibles sur les URL distantes (Safari, deuxième tablette).

Correspondances : 01 Prout, 02 Bravo, 03 Danse, 04 Oups, 05 Présentation à droite, 06 Rires, 07 Surprise, 08 Au revoir, 09 Présentation bis, 10 Bravo bis.

Test : le bouton « Commencer » lance Présentation ; un prout lance Prout ; toucher Gus déclenche Rires ; bonne réponse : Bravo/Danse/Rires ; erreur : Oups ; fin : Au revoir. Tous les clips peuvent aussi être déclenchés par la barre de test ajoutée sous Gus.

Le fond transparent est fourni en WebP animé 15 images/s. L'audio est séparé en M4A car Safari/iPad ne gère pas de façon universelle la transparence dans un MP4 classique. Les MP4 « sans logo » à fond noir sont des fichiers de secours, **pas** le format final d'intégration.

Attention : la voix générée par le navigateur et les anciens bruitages restent disponibles en complément ; un test réel sur iPad est nécessaire pour valider la priorité et le volume des sons.
