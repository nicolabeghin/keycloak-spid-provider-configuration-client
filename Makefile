start: createfolders build
	mkdir -p log
	docker compose up

createfolders:
	mkdir -p log || true

build:
	docker compose build

download-metadatas:
	rm -fr entities-idp || true
	mkdir -p entities-idp
	rm -f download.sh || true
	echo "#!/bin/bash" > download.sh
	echo "curl -s -o validator.xml https://validator.spid.gov.it/metadata.xml" >> download.sh
	echo "curl -s -o demo.xml https://demo.spid.gov.it/validator/metadata.xml" >> download.sh
	curl -s https://registry.spid.gov.it/entities-idp?&output=json | jq -r '.[] | ["curl","-s","-o", "entities-idp/",.file_name,.registry_link] | join(" ")' | sed 's/\?output=json//g' >> download.sh
	chmod +x download.sh

