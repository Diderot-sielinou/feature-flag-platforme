#!/bin/bash

# test-compilation-execution.sh

set -e # Arrête le script en cas d'erreur

echo "=== Démarrage du test de compilation et d'exécution ==="

# Assurez-vous que les dépendances sont installées
echo "Installation des dépendances..."
npm install

# --- Test de la compilation ---

echo "Compilation de l'application api-management..."
npm run build --prefix apps/api-management
echo "Compilation de l'application api-read..."
npm run build --prefix apps/api-read
# Ajoutez d'autres apps si nécessaire

echo "Compilation des packages partagés (si nécessaire)..."
# npm run build --prefix packages/sdk # Si votre SDK a une étape de build
# npm run build --prefix packages/database # Si votre base de données a une étape de build

echo "Compilation réussie pour toutes les apps !"

# --- Test de l'exécution (dans un processus séparé pour chaque app) ---

echo "Démarrage des applications en arrière-plan..."

# Démarrer api-management
echo "Démarrage de api-management..."
cd apps/api-management
node dist/main.js > api-management.log 2>&1 &
API_MANAGEMENT_PID=$!
cd ../.. # Revenir à la racine

# Démarrer api-read
echo "Démarrage de api-read..."
cd apps/api-read
node dist/main.js > api-read.log 2>&1 &
API_READ_PID=$!
cd ../.. # Revenir à la racine

# Ajoutez d'autres apps ici si nécessaire

echo "Applications démarrées (PIDs: $API_MANAGEMENT_PID, $API_READ_PID, ...)"

# Attendre un peu pour voir si elles démarrent correctement
sleep 10

# Vérifier si les processus sont toujours actifs
if kill -0 $API_MANAGEMENT_PID 2>/dev/null; then
    echo "✅ api-management semble démarré correctement (PID: $API_MANAGEMENT_PID)"
else
    echo "❌ api-management a probablement échoué au démarrage (PID: $API_MANAGEMENT_PID)"
    cat apps/api-management/api-management.log
    exit 1
fi

if kill -0 $API_READ_PID 2>/dev/null; then
    echo "✅ api-read semble démarré correctement (PID: $API_READ_PID)"
else
    echo "❌ api-read a probablement échoué au démarrage (PID: $API_READ_PID)"
    cat apps/api-read/api-read.log
    exit 1
fi

# Ajoutez d'autres vérifications ici si nécessaire

echo "✅ Toutes les applications ont démarré sans erreur évidente dans les 10 premières secondes."

# Arrêter les applications
echo "Arrêt des applications..."
kill $API_MANAGEMENT_PID || true
kill $API_READ_PID || true
# kill $OTHER_PID || true # Ajoutez d'autres PIDs ici

echo "Applications arrêtées."

echo "=== Test de compilation et d'exécution terminé avec succès ==="