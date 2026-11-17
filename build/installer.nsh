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

; Akta ouvert pendant l'installation / la désinstallation.
;
; Remplace la vérification par défaut d'electron-builder (_CHECK_APP_RUNNING), qui posait deux problèmes :
;   - elle cherche l'app avec "tasklist /FI USERNAME eq %USERNAME%", un filtre qui échoue sur certains
;     comptes (compte Microsoft, installeur élevé…) : l'app n'est alors pas vue, et l'installation bute
;     plus loin sur les fichiers verrouillés ("Akta ne peut pas être fermé…") ;
;   - son taskkill "poli" (WM_CLOSE) est intercepté par Akta, qui se réduit dans le tray.
; Ici :
;   1. détection via nsProcess (énumère tous les processus, sans filtre utilisateur) ;
;   2. on demande à l'utilisateur s'il veut fermer Akta (sauf mise à jour auto ou mode silencieux) ;
;   3. on relance Akta avec --akta-quit : l'instance ouverte quitte proprement et enregistre la
;      session en cours (voir QUIT_FLAG dans src/main/index.ts) ;
;   4. si elle tourne encore après ~5 s (ancienne version sans ce drapeau, app bloquée…), on force.
; Aucune étiquette (label) ici : on passe uniquement par LogicLib, qui génère des étiquettes uniques.
!macro _AKTA_FIND_PROCESS _ERR
  ${nsProcess::FindProcess} "${APP_EXECUTABLE_FILENAME}" ${_ERR}
!macroend

!macro customCheckAppRunning
  !insertmacro _AKTA_FIND_PROCESS $R0
  ${If} $R0 == 0
    ${IfNot} ${isUpdated}
      ${IfNot} ${Cmd} `MessageBox MB_YESNO|MB_ICONQUESTION "${PRODUCT_NAME} est en cours d'exécution.$\r$\n$\r$\nLe fermer pour continuer ? La session en cours sera enregistrée." /SD IDYES IDYES`
        Quit
      ${EndIf}
    ${EndIf}

    DetailPrint `Fermeture de "${PRODUCT_NAME}"...`
    ${If} ${FileExists} "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
      Exec `"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --akta-quit`
    ${EndIf}

    ; Laisse jusqu'à ~5 s à l'app pour quitter d'elle-même.
    StrCpy $R1 0
    ${Do}
      Sleep 500
      IntOp $R1 $R1 + 1
      !insertmacro _AKTA_FIND_PROCESS $R0
    ${LoopUntil} $R0 != 0
    ${OrIf} $R1 >= 10

    ; Toujours là : fermeture forcée de tous les processus Akta.exe.
    ${DoWhile} $R0 == 0
      ${nsProcess::KillProcess} "${APP_EXECUTABLE_FILENAME}" $R2
      nsExec::Exec `"$SYSDIR\taskkill.exe" /f /t /im "${APP_EXECUTABLE_FILENAME}"`
      Pop $R2
      Sleep 1000
      !insertmacro _AKTA_FIND_PROCESS $R0
      ${If} $R0 == 0
        ${IfNot} ${Cmd} `MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "Impossible de fermer ${PRODUCT_NAME}. Fermez-le manuellement puis cliquez sur Réessayer." /SD IDCANCEL IDRETRY`
          Quit
        ${EndIf}
      ${EndIf}
    ${Loop}
  ${EndIf}
!macroend
