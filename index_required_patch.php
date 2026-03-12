<?php
/**
 * PATCH: à copier dans index.php pour remplacer la section du formulaire
 * (lignes 984 à 1212 environ).
 * Remplacer tout le bloc entre :
 *   <div class="form-group full-width">
 *       <label>Adresse</label>
 * et
 *   <div class="form-group full-width">
 *       <label>Commentaire Agent</label>
 * par le contenu ci-dessous (sans les balises <?php et ?> de ce fichier).
 */
?>
                    <div class="form-group full-width">
                        <label>Adresse <span class="required">*</span></label>
                        <input type="text" name="adresse" value="<?php 
                            $adresse = trim(($vicidialData['address1'] ?? '') . ' ' . ($vicidialData['address2'] ?? ''));
                            echo htmlspecialchars($adresse);
                        ?>" required>
                    </div>
                    <div class="form-group">
                        <label>Code Postal <span class="required">*</span></label>
                        <input type="text" name="code_postal" value="<?php echo htmlspecialchars($vicidialData['postal_code'] ?? ''); ?>" required>
                    </div>
                    <div class="form-group">
                        <label>Ville <span class="required">*</span></label>
                        <input type="text" name="ville" value="<?php echo htmlspecialchars($vicidialData['city'] ?? ''); ?>" required>
                    </div>
                </div>
            </div>
            
            <!-- Informations d'appel -->
            <div class="form-section">
                <div class="section-title">Informations d'Appel</div>
                <div class="form-grid">
                    <div class="form-group">
                        <label>Date et Heure d'Appel</label>
                        <input type="datetime-local" name="date_appel" value="<?php 
                            $modifyDate = $vicidialData['modify_date'] ?? null;
                            if (!empty($modifyDate) && ($ts = strtotime($modifyDate)) !== false) {
                                echo date('Y-m-d\TH:i', $ts);
                            } else {
                                echo date('Y-m-d\TH:i');
                            }
                        ?>">
                    </div>
                </div>
            </div>
            
            <!-- Critères Client -->
            <div class="form-section">
                <div class="section-title">Critères Client</div>
                <div class="form-grid">
                    <div class="form-group">
                        <label>Situation Conjugale <span class="required">*</span></label>
                        <select name="situation_conjugale" required>
                            <option value="">-- Sélectionner --</option>
                            <option value="Célibataire">Célibataire</option>
                            <option value="Marié(e)">Marié(e)</option>
                            <option value="Concubinage">Concubinage</option>
                            <option value="Divorcé(e)">Divorcé(e)</option>
                            <option value="Veuf(ve)">Veuf(ve)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Âge M. <span class="required">*</span></label>
                        <input type="number" name="age_mr" min="18" max="120" required>
                    </div>
                    <div class="form-group">
                        <label>Âge Mme <span class="required">*</span></label>
                        <input type="number" name="age_madame" min="18" max="120" required>
                    </div>
                    <div class="form-group">
                        <label>Nombre d'Enfants <span class="required">*</span></label>
                        <input type="number" name="nb_enfants" min="0" value="0" required>
                    </div>
                    <div class="form-group">
                        <label>Profession M. <span class="required">*</span></label>
                        <select name="profession_mr" required>
                            <option value="">-- Sélectionner --</option>
                            <?php foreach ($professions as $prof): ?>
                                <option value="<?php echo htmlspecialchars($prof['id']); ?>">
                                    <?php echo htmlspecialchars($prof['nom']); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Profession Mme <span class="required">*</span></label>
                        <select name="profession_madame" required>
                            <option value="">-- Sélectionner --</option>
                            <?php foreach ($professions as $prof): ?>
                                <option value="<?php echo htmlspecialchars($prof['id']); ?>">
                                    <?php echo htmlspecialchars($prof['nom']); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Type Contrat M. <span class="required">*</span></label>
                        <select name="type_contrat_mr" required>
                            <option value="">-- Sélectionner --</option>
                            <?php foreach ($typeContrats as $contrat): ?>
                                <option value="<?php echo htmlspecialchars($contrat['id']); ?>">
                                    <?php echo htmlspecialchars($contrat['nom']); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Type Contrat Mme <span class="required">*</span></label>
                        <select name="type_contrat_madame" required>
                            <option value="">-- Sélectionner --</option>
                            <?php foreach ($typeContrats as $contrat): ?>
                                <option value="<?php echo htmlspecialchars($contrat['id']); ?>">
                                    <?php echo htmlspecialchars($contrat['nom']); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Entretien avec <span class="required">*</span></label>
                        <select name="entretien_avec" required>
                            <option value="">-- Sélectionner --</option>
                            <option value="Monsieur">Monsieur</option>
                            <option value="Madame">Madame</option>
                            <option value="Couple">Couple</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Propriétaire Maison <span class="required">*</span></label>
                        <select name="proprietaire_maison" required>
                            <option value="">-- Sélectionner --</option>
                            <option value="MR">MR</option>
                            <option value="MME">MME</option>
                            <option value="LES DEUX">LES DEUX</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Revenu du Foyer <span class="required">*</span></label>
                        <input type="text" name="revenu_foyer" placeholder="Ex: 3000-5000€" required>
                    </div>
                </div>
            </div>
            
            <!-- Critères Techniques -->
            <div class="form-section">
                <div class="section-title">Critères Techniques</div>
                <div class="form-grid">
                    <div class="form-group">
                        <label>Produit <span class="required">*</span></label>
                        <select name="produit" id="produit" onchange="toggleProductFields()" required>
                            <option value="">-- Sélectionner --</option>
                            <?php foreach ($produits as $produit): ?>
                                <option value="<?php echo htmlspecialchars($produit['id']); ?>" 
                                        data-nom="<?php echo htmlspecialchars(strtoupper($produit['nom'] ?? '')); ?>">
                                    <?php echo htmlspecialchars($produit['nom']); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Déjà fait une étude <span class="required">*</span></label>
                        <select name="etude" required>
                            <option value="">-- Sélectionner --</option>
                            <option value="OUI">OUI</option>
                            <option value="NON">NON</option>
                        </select>
                    </div>
                    
                    <!-- Champs communs -->
                    <div class="form-group champ-pac" style="display: none;">
                        <label>Surface Habitable (m²) <span class="required">*</span></label>
                        <input type="text" name="surface_habitable" placeholder="Ex: 120" required>
                    </div>
                    <div class="form-group champ-commun champ-pac">
                        <label>Nombre de Pièces <span class="required">*</span></label>
                        <input type="number" name="nb_pieces" min="1" required>
                    </div>
                    
                    <!-- Champs spécifiques PAC -->
                    <div class="form-group champ-pac" style="display: none;">
                        <label>Mode de Chauffage <span class="required">*</span></label>
                        <select name="mode_chauffage" required>
                            <option value="">-- Sélectionner --</option>
                            <?php foreach ($modeChauffages as $mode): ?>
                                <option value="<?php echo htmlspecialchars($mode['id']); ?>">
                                    <?php echo htmlspecialchars($mode['nom']); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="form-group champ-pac" style="display: none;">
                        <label>Année Système Chauffage <span class="required">*</span></label>
                        <input type="number" name="annee_systeme_chauffage" min="1900" max="<?php echo date('Y'); ?>" required>
                    </div>
                    <div class="form-group champ-pac" style="display: none;">
                        <label>Surface Chauffée (m²) <span class="required">*</span></label>
                        <input type="text" name="surface_chauffee" placeholder="Ex: 100" required>
                    </div>
                    <div class="form-group champ-pac" style="display: none;">
                        <label>Consommation Chauffage (€) <span class="required">*</span></label>
                        <input type="text" name="consommation_chauffage" placeholder="Ex: 1500 €/an" required>
                    </div>
                    
                    <!-- Champs spécifiques PV -->
                    <div class="form-group champ-pv" style="display: none;">
                        <label>Surface Bâtie au Sol (m²) <span class="required">*</span></label>
                        <input type="text" name="surface_habitable" placeholder="Ex: 120" required>
                    </div>
                    <div class="form-group champ-pv" style="display: none;">
                        <label>Nombre de Pans <span class="required">*</span></label>
                        <input type="number" name="nb_pans" min="1" required>
                    </div>
                    <div class="form-group champ-pv" style="display: none;">
                        <label>Consommation Électricité (€) <span class="required">*</span></label>
                        <input type="text" name="consommation_electricite" placeholder="Ex: 800 €/an" required>
                    </div>
                    <div class="form-group champ-pv" style="display: none;">
                        <label>Orientation Toiture <span class="required">*</span></label>
                        <select name="orientation_toiture" required>
                            <option value="">-- Sélectionner --</option>
                            <option value="Nord">Nord</option>
                            <option value="Nord-Est">Nord-Est</option>
                            <option value="Est">Est</option>
                            <option value="Sud-Est">Sud-Est</option>
                            <option value="Sud">Sud</option>
                            <option value="Sud-Ouest">Sud-Ouest</option>
                            <option value="Ouest">Ouest</option>
                            <option value="Est Ouest">Est Ouest</option>
                            <option value="Nord-Ouest">Nord-Ouest</option>
                        </select>
                    </div>
                    <div class="form-group champ-pv" style="display: none;">
                        <label>Zones d'Ombres <span class="required">*</span></label>
                        <input type="text" name="zones_ombres" placeholder="Décrire les zones d'ombres" required>
                    </div>
                    <div class="form-group champ-pv" style="display: none;">
                        <label>Site Classé <span class="required">*</span></label>
                        <select name="site_classe" required>
                            <option value="">-- Sélectionner --</option>
                            <option value="OUI">OUI</option>
                            <option value="NON">NON</option>
                        </select>
                    </div>
                    
                    <div class="form-group full-width">
                        <label>Commentaire Agent</label>
                        <textarea name="commentaire_agent" placeholder="Notes supplémentaires..."></textarea>
                    </div>
