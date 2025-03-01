start: createfolders build
	docker run --net=host -w /usr/src/app --rm -v ${PWD}/log:/usr/src/app/log spidclient:latest

createfolders:
	mkdir -p log || true

build:
	docker build -t spidclient .

download-metadatas:
	rm -fr entities-idp || true
	mkdir -p entities-idp
	rm -f download.sh || true
	echo "#!/bin/bash" > download.sh
	echo "curl -s -o validator.xml https://validator.spid.gov.it/metadata.xml" >> download.sh
	echo "curl -s -o demo.xml https://demo.spid.gov.it/validator/metadata.xml" >> download.sh
	curl -s https://registry.spid.gov.it/entities-idp?&output=json | jq -r '.[] | ["curl","-s","-o", "entities-idp/",.file_name,.registry_link] | join(" ")' | sed 's/\?output=json//g' >> download.sh
	chmod +x download.sh

