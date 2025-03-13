#Connection between the cluster and the Azure repository

#!/bin/bash

# Exit immediately if a command fails
set -e

# Function to display error messages and exit
error_exit() {
    echo "❌ ERROR: $1"
    exit 1
}

# Function to validate required variables
validate_variable() {
    if [ -z "$2" ]; then
        error_exit "Variable '$1' is not set. Please update the script with the correct values."
    fi
}

# ---- USER CONFIGURATION ----
# Update these variables before running the script

AKS_SUBSCRIPTION_ID="" # first subscription
AKS_RESOURCE_GROUP=""
AKS_NAME=""

ACR_SUBSCRIPTION_ID="" # second subscription
ACR_RESOURCE_GROUP=""
ACR_NAME=""  # ACR name without .azurecr.io

# ---- VALIDATE INPUT VARIABLES ----
validate_variable "AKS_SUBSCRIPTION_ID" "$AKS_SUBSCRIPTION_ID"
validate_variable "AKS_RESOURCE_GROUP" "$AKS_RESOURCE_GROUP"
validate_variable "AKS_NAME" "$AKS_NAME"
validate_variable "ACR_SUBSCRIPTION_ID" "$ACR_SUBSCRIPTION_ID"
validate_variable "ACR_NAME" "$ACR_NAME"
validate_variable "ACR_RESOURCE_GROUP" "$ACR_RESOURCE_GROUP"
# ---- SCRIPT STARTS ----
echo "🚀 Starting AKS-ACR connection process..."
echo "🔹 Switching to AKS Subscription: $AKS_SUBSCRIPTION_ID"
az account set --subscription "$AKS_SUBSCRIPTION_ID" || error_exit "Failed to switch to AKS subscription."

echo "🔹 Fetching AKS Identity..."
AKS_IDENTITY=$(az aks show --resource-group "$AKS_RESOURCE_GROUP" --name "$AKS_NAME" --query "identityProfile.kubeletidentity.objectId" -o tsv 2>/dev/null) || true

if [ -z "$AKS_IDENTITY" ]; then
    echo "🔹 AKS does not have a managed identity, checking for Service Principal..."
    AKS_IDENTITY=$(az aks show --resource-group "$AKS_RESOURCE_GROUP" --name "$AKS_NAME" --query "servicePrincipalProfile.clientId" -o tsv) || error_exit "Failed to retrieve AKS Service Principal."
fi

validate_variable "AKS Identity (Managed Identity or Service Principal)" "$AKS_IDENTITY"
echo "✅ AKS Identity Retrieved: $AKS_IDENTITY"

echo "🔹 Switching to ACR Subscription: $ACR_SUBSCRIPTION_ID"
az account set --subscription "$ACR_SUBSCRIPTION_ID" || error_exit "Failed to switch to ACR subscription."

echo "🔹 Fetching ACR ID..."
ACR_ID=$(az acr show --name "$ACR_NAME" --resource-group "$ACR_RESOURCE_GROUP" --query id -o tsv) || error_exit "Failed to retrieve ACR ID."

echo "🔹 Assigning AcrPull role to AKS identity..."
az role assignment create --assignee "$AKS_IDENTITY" --role "AcrPull" --scope "$ACR_ID" || error_exit "Failed to assign AcrPull role."

echo "✅ AcrPull role assigned successfully."

echo "🔹 Verifying role assignment..."
ASSIGNED_ROLE=$(az role assignment list --assignee "$AKS_IDENTITY" --scope "$ACR_ID" --query "[].roleDefinitionName" -o tsv)

if [[ "$ASSIGNED_ROLE" == "AcrPull" ]]; then
    echo "✅ AKS is now connected to ACR successfully!"
else
    error_exit "Role assignment verification failed. Please check manually."
fi

echo "🚀 Your AKS cluster can now pull images from ACR!"
