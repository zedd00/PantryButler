#!/bin/bash

ast-grep scan -r .rules/SelectItem.yml

ast-grep scan -r .rules/contrast.yml

ast-grep scan -r .rules/toast-hook.yml

ast-grep scan -r .rules/slot-nesting.yml

ast-grep scan -r .rules/require-button-interaction.yml
