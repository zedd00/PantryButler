#!/usr/bin/env python3
"""
Test the translation file parser with sample data
"""

import re

def parse_translation_file_test(content):
    """
    Parse translation content with new format: one item per line
    Format: (####)$item,
    """
    lines = content.strip().split('\n')
    translations = {}
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Pattern: (####)text, or (####)text
        match = re.match(r'\((\d{4})\)(.+?)(?:,\s*)?$', line)
        
        if match:
            num = match.group(1)
            text = match.group(2).strip()
            translations[num] = text
        else:
            # Try to extract number and text even if format is slightly off
            alt_match = re.search(r'\((\d{4})\)', line)
            if alt_match:
                num = alt_match.group(1)
                text = line[alt_match.end():].strip()
                if text.endswith(','):
                    text = text[:-1].strip()
                if text:
                    translations[num] = text
    
    return translations


# Test cases
test_cases = [
    # Standard format with comma
    "(0001)flour,",
    "(0002)sugar,",
    "(0003)salt,",
    
    # Without comma
    "(0004)pepper",
    "(0005)butter",
    
    # With extra spaces
    "(0006)  milk  ,",
    "(0007)eggs   ",
    
    # Special characters
    "(0008)café,",
    "(0009)jalapeño,",
    "(0010)crème fraîche,",
    
    # Unicode (Hindi)
    "(0011)आटा,",
    "(0012)चीनी,",
    
    # Unicode (Chinese)
    "(0013)面粉,",
    "(0014)糖,",
]

print("=" * 80)
print("TRANSLATION PARSER TEST")
print("=" * 80)
print()

# Test each case
content = '\n'.join(test_cases)
print("Test input:")
print("-" * 40)
print(content)
print("-" * 40)
print()

# Parse
translations = parse_translation_file_test(content)

print("Parsed results:")
print("-" * 40)
for num, text in sorted(translations.items()):
    print(f"  {num}: '{text}'")
print("-" * 40)
print()

# Verify
expected_count = len(test_cases)
actual_count = len(translations)

print(f"Expected: {expected_count} items")
print(f"Parsed: {actual_count} items")
print()

if actual_count == expected_count:
    print("✅ TEST PASSED: All items parsed correctly")
    
    # Verify specific items
    checks = [
        ('0001', 'flour'),
        ('0004', 'pepper'),
        ('0006', 'milk'),
        ('0008', 'café'),
        ('0011', 'आटा'),
        ('0013', '面粉'),
    ]
    
    all_correct = True
    for num, expected_text in checks:
        actual_text = translations.get(num, '')
        if actual_text == expected_text:
            print(f"  ✓ {num}: '{actual_text}'")
        else:
            print(f"  ✗ {num}: expected '{expected_text}', got '{actual_text}'")
            all_correct = False
    
    if all_correct:
        print()
        print("✅ ALL CHECKS PASSED")
    else:
        print()
        print("⚠️  SOME CHECKS FAILED")
else:
    print("❌ TEST FAILED: Item count mismatch")

print()
print("=" * 80)
