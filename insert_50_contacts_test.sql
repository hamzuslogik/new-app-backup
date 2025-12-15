-- Script SQL pour insérer 50 contacts de test avec le mapping utilisé dans l'import
-- Mapping: nom=first_name, prenom=last_name, tel=phone_number, gsm1=alt_phone, adresse=address1, cp=postal_code, ville=city

-- Supprimer les fiches de test existantes (optionnel)
-- DELETE FROM fiches WHERE id_agent = 999 AND id_centre = 1;

-- Insérer 50 fiches de test
INSERT INTO fiches (
  `nom`, `prenom`, `tel`, `gsm1`, `adresse`, `cp`, `ville`,
  `id_agent`, `id_centre`, `date_insert`, `date_insert_time`, 
  `date_modif_time`, `archive`, `active`, `ko`, `hc`, `valider`
) VALUES
('Jean', 'Dupont', '0612345678', '0698765432', '123 Rue de la République', '75001', 'Paris', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Marie', 'Martin', '0623456789', '0687654321', '45 Avenue des Champs', '69001', 'Lyon', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Pierre', 'Bernard', '0634567890', '0676543210', '78 Boulevard Saint-Michel', '13001', 'Marseille', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Sophie', 'Dubois', '0645678901', '0665432109', '12 Place de la Comédie', '33000', 'Bordeaux', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Luc', 'Moreau', '0656789012', '0654321098', '56 Rue de la Paix', '31000', 'Toulouse', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Claire', 'Petit', '0667890123', '0643210987', '89 Avenue Jean Jaurès', '59000', 'Lille', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Antoine', 'Roux', '0678901234', '0632109876', '34 Rue du Commerce', '67000', 'Strasbourg', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Isabelle', 'Simon', '0689012345', '0621098765', '67 Boulevard de la Liberté', '44000', 'Nantes', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('François', 'Laurent', '0690123456', '0610987654', '23 Place Bellecour', '69002', 'Lyon', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Céline', 'Lefebvre', '0611234567', '0609876543', '90 Rue de Rivoli', '75002', 'Paris', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Nicolas', 'Garcia', '0622345678', '0698765432', '45 Avenue Victor Hugo', '06000', 'Nice', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Julie', 'David', '0633456789', '0687654321', '12 Rue de la Soif', '35000', 'Rennes', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Thomas', 'Bertrand', '0644567890', '0676543210', '78 Boulevard Haussmann', '75008', 'Paris', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Camille', 'Rousseau', '0655678901', '0665432109', '34 Rue de la République', '13002', 'Marseille', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Julien', 'Vincent', '0666789012', '0654321098', '56 Place du Capitole', '31001', 'Toulouse', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Émilie', 'Fournier', '0677890123', '0643210987', '89 Rue de la Gare', '59001', 'Lille', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Maxime', 'Girard', '0688901234', '0632109876', '23 Avenue de la Grande Armée', '75016', 'Paris', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Laura', 'Bonnet', '0699012345', '0621098765', '67 Boulevard de Strasbourg', '67001', 'Strasbourg', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Romain', 'Dupuis', '0610123456', '0610987654', '34 Rue Crébillon', '44001', 'Nantes', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Manon', 'Lambert', '0621234567', '0609876543', '12 Place de la Bourse', '33001', 'Bordeaux', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Alexandre', 'Fontaine', '0632345678', '0698765432', '45 Rue de la République', '06001', 'Nice', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Sarah', 'Lucas', '0643456789', '0687654321', '78 Avenue des Ternes', '75017', 'Paris', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Baptiste', 'Joly', '0654567890', '0676543210', '23 Boulevard de la Croisette', '06400', 'Cannes', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Léa', 'Garnier', '0665678901', '0665432109', '56 Rue de la Paix', '35001', 'Rennes', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Hugo', 'Roche', '0676789012', '0654321098', '89 Place de la Comédie', '34000', 'Montpellier', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Chloé', 'Clement', '0687890123', '0643210987', '34 Rue de la Soif', '13003', 'Marseille', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Adrien', 'Lopez', '0698901234', '0632109876', '67 Avenue Jean Jaurès', '69003', 'Lyon', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Emma', 'Henry', '0619012345', '0621098765', '12 Boulevard Saint-Michel', '75005', 'Paris', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Lucas', 'Martinez', '0620123456', '0610987654', '45 Rue du Commerce', '31002', 'Toulouse', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Inès', 'Legrand', '0631234567', '0609876543', '78 Place Bellecour', '69004', 'Lyon', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Paul', 'Fabre', '0642345678', '0698765432', '23 Rue de Rivoli', '75003', 'Paris', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Zoé', 'Blanc', '0653456789', '0687654321', '56 Avenue Victor Hugo', '06002', 'Nice', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Mathis', 'Guerin', '0664567890', '0676543210', '89 Boulevard Haussmann', '75009', 'Paris', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Louise', 'Muller', '0675678901', '0665432109', '34 Rue de la Gare', '59002', 'Lille', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Nathan', 'Boyer', '0686789012', '0654321098', '12 Place du Capitole', '31003', 'Toulouse', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Léna', 'Schmitt', '0697890123', '0643210987', '67 Rue de la République', '13004', 'Marseille', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Enzo', 'Colin', '0618901234', '0632109876', '23 Boulevard de la Liberté', '44002', 'Nantes', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Mia', 'Dumas', '0629012345', '0621098765', '45 Avenue de la Grande Armée', '75010', 'Paris', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Noah', 'Brun', '0630123456', '0610987654', '78 Rue Crébillon', '33002', 'Bordeaux', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Lina', 'Dufour', '0641234567', '0609876543', '12 Place de la Bourse', '67002', 'Strasbourg', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Gabriel', 'Masson', '0652345678', '0698765432', '56 Rue de la Paix', '35002', 'Rennes', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Jade', 'Marchand', '0663456789', '0687654321', '89 Avenue des Champs', '75011', 'Paris', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Raphaël', 'Noel', '0674567890', '0676543210', '34 Boulevard Saint-Michel', '06003', 'Nice', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Anna', 'Perez', '0685678901', '0665432109', '67 Place de la Comédie', '69005', 'Lyon', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Louis', 'Cousin', '0696789012', '0654321098', '23 Rue du Commerce', '31004', 'Toulouse', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Rose', 'Vasseur', '0617890123', '0643210987', '45 Avenue Jean Jaurès', '59003', 'Lille', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Ethan', 'Carpentier', '0628901234', '0632109876', '78 Boulevard Haussmann', '13005', 'Marseille', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Amélie', 'Lemaire', '0639012345', '0621098765', '12 Rue de Rivoli', '44003', 'Nantes', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Lucas', 'Gauthier', '0640123456', '0610987654', '56 Place Bellecour', '33003', 'Bordeaux', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0),
('Lola', 'Hamon', '0651234567', '0609876543', '89 Avenue Victor Hugo', '67003', 'Strasbourg', 1, 1, UNIX_TIMESTAMP(), NOW(), NOW(), 0, 1, 0, 0, 0);

-- Vérifier l'insertion
SELECT COUNT(*) as nombre_fiches_inserees FROM fiches WHERE id_agent = 1 AND id_centre = 1 AND date_insert >= UNIX_TIMESTAMP() - 60;

-- Afficher quelques exemples
SELECT id, nom, prenom, tel, gsm1, adresse, cp, ville, date_insert_time 
FROM fiches 
WHERE id_agent = 1 AND id_centre = 1 
ORDER BY id DESC 
LIMIT 10;

