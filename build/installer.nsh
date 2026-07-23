; Ajoute une case à cocher "Créer un raccourci sur le bureau" sur la page de fin d'installation.
;
; electron-builder n'expose pas ce choix nativement : "createDesktopShortcut" n'est qu'un booléen figé
; à la configuration (soit toujours créé, soit jamais). On réutilise donc le slot "Show readme" de la
; page de fin MUI2 (astuce NSIS standard, voir la doc electron-builder sur les scripts "include") pour
; y greffer notre propre case à cocher et notre propre action.
;
; Important : ce script est inclus DEUX FOIS par electron-builder — une passe pour compiler
; l'installeur, une pour compiler le désinstalleur (distingué par la constante BUILD_UNINSTALLER).
; La page de fin du désinstalleur (MUI_UNPAGE_FINISH) réutilise la même valeur de
; MUI_FINISHPAGE_SHOWREADME_FUNCTION ; sans le garde ci-dessous, elle tenterait d'appeler une fonction
; qui ne commence pas par "un.", ce que NSIS interdit côté désinstalleur → échec de compilation.
; On ne définit donc la case à cocher que pour la passe installeur.

!ifndef BUILD_UNINSTALLER
  !define MUI_FINISHPAGE_SHOWREADME ""
  !define MUI_FINISHPAGE_SHOWREADME_TEXT "Créer un raccourci sur le bureau"
  !define MUI_FINISHPAGE_SHOWREADME_FUNCTION CreateDesktopShortcutIfChecked

  Function CreateDesktopShortcutIfChecked
    ; APP_EXECUTABLE_FILENAME n'est défini que plus tard par common.nsh, qui n'est pas encore inclus à
    ; ce stade (notre script est injecté dans l'en-tête généré par electron-builder). PRODUCT_FILENAME,
    ; lui, est passé directement en ligne de commande à makensis, donc déjà disponible ici.
    CreateShortCut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_FILENAME}.exe"
  FunctionEnd
!endif
