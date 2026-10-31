import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import generate_halloween_event as event


class HalloweenDraftTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads(event.DATA_PATH.read_text(encoding="utf-8"))

    def test_published_and_thirteen_costumes(self):
        event.validate_data(self.data)
        page = event.render_page(self.data)
        self.assertNotIn('content="noindex, nofollow, noarchive"', page)
        self.assertIn('rel="canonical" href="https://mainichi-miru.com/lounge/events/halloween-2026/"', page)
        self.assertNotIn('class="hw-draft-banner"', page)
        self.assertEqual(page.count('<article class="hw-costume-card">'), 13)
        self.assertEqual(page.count("<h1>"), 1)
        self.assertIn('ハロウィンパーティーの会話', page)
        self.assertNotIn('セクション', page)
        self.assertNotIn('hw-record-count', page)
        self.assertNotIn('順次追加', page)
        self.assertIn('class="hw-scene-nav"', page)
        self.assertNotIn('class="hw-time-nav"', page)
        self.assertNotIn('朝のラウンジ', page)

    def test_cannot_implicitly_publish(self):
        for status in ("unlisted", "", None):
            with self.subTest(status=status):
                self.data["status"] = status
                with self.assertRaises(ValueError):
                    event.validate_data(self.data)

    def test_missing_or_duplicate_participant(self):
        self.data["participants"][-1] = self.data["participants"][0]
        with self.assertRaises(ValueError):
            event.validate_data(self.data)

    def test_escaped_conversation_and_unique_anchor(self):
        self.data["conversationSections"] = [{
            "id": "section-test", "time": "18:00", "title": "追記する会話",
            "blocks": [{"type": "dialogue", "speaker": "所長よっしー", "text": '<script>alert("test")</script>\n次の段落'}],
        }]
        event.validate_data(self.data)
        page = event.render_page(self.data)
        self.assertIn('id="section-test"', page)
        self.assertIn('datetime="2026-10-31T18:00+09:00"', page)
        self.assertIn('&lt;script&gt;', page)
        self.assertNotIn('<script>alert', page)
        self.assertIn('ハロウィンパーティーの会話', page)
        self.assertNotIn('class="hw-scene-nav"', page)

    def test_duplicate_section_and_unknown_speaker(self):
        section = {"id": "first", "title": "記録", "blocks": [{"type": "dialogue", "speaker": "未登録の人", "text": "テキスト"}]}
        self.data["conversationSections"] = [section]
        with self.assertRaises(ValueError):
            event.validate_data(self.data)
        section["blocks"][0]["speaker"] = "ほのちゃん"
        self.data["conversationSections"].append(copy.deepcopy(section))
        with self.assertRaises(ValueError):
            event.validate_data(self.data)

    def test_first_scene_order_and_image_after_conversation(self):
        section = self.data['conversationSections'][0]
        self.assertEqual(section['id'], 'section-01')
        self.assertEqual(section['time'], '18:00')
        self.assertEqual(sum(b['type'] == 'dialogue' for b in section['blocks']), 52)
        self.assertEqual(section['blocks'][-1]['type'], 'image')
        scene = event.render_conversations(self.data)
        closing_photo = f'src="{event.PREFIX}{section["blocks"][-1]["src"]}"'
        self.assertLess(scene.index('今年のハロウィンパーティーは、まだ始まったばかりだ。'), scene.index(closing_photo))
        self.assertIn('STARLINE／宇宙飛行士', scene)
        # Adding a later scene appends it to the same story, with no time-of-day grouping.
        later = copy.deepcopy(section)
        later.update(id='section-02', title='みんなの仮装披露', time='18:30')
        self.data['conversationSections'] = [section, later]
        event.validate_data(self.data)
        page = event.render_page(self.data)
        self.assertEqual(page.count('class="hw-conversation-group"'), 2)
        self.assertIn('aria-label="会話の場面へ移動"', page)
        self.assertLess(page.index('id="section-01"'), page.index('id="section-02"'))

    def test_costume_conversation_subheadings_and_closing_image(self):
        scene = self.data['conversationSections'][1]
        self.assertEqual(scene['id'], 'section-02')
        self.assertEqual(scene['time'], '18:18')
        self.assertIn('18:18〜18:35', scene['timeLabel'])
        self.assertEqual(sum(b['type'] == 'dialogue' for b in scene['blocks']), 57)
        headings = [b['text'] for b in scene['blocks'] if b['type'] == 'heading']
        self.assertEqual(headings, ['🌟 ほのちゃんの宇宙飛行士', '🏠 ショウマの物件案内', '⚜️ たかけん、神として降臨'])
        self.assertEqual(scene['blocks'][-1]['src'], 'image/events/halloween-2026/sofa-conversation.webp')
        page = event.render_page(self.data)
        only_this_scene = event.render_conversations({**self.data, 'conversationSections': [scene]})
        self.assertEqual(only_this_scene.count('<h4 class="hw-story-subheading">'), 3)
        self.assertLess(page.index('id="section-01"'), page.index('id="section-02"'))
        self.assertLess(page.index('その光景を、脇に立つ巨大な月見団子が静かに見守っていた。'), page.index('src="../../../image/events/halloween-2026/sofa-conversation.webp"'))
        markup = event.render_block({'type': 'heading', 'text': '<script>test</script>'}, self.data['participants'])
        self.assertIn('&lt;script&gt;test&lt;/script&gt;', markup)

    def test_late_party_conversation_and_group_shout(self):
        scene = self.data['conversationSections'][-1]
        self.assertEqual(scene['id'], 'section-12')
        self.assertEqual(scene['timeLabel'], '19:50〜20:45')
        self.assertEqual(sum(b['type'] == 'dialogue' for b in scene['blocks']), 233)
        photos = [b['src'].rsplit('/', 1)[-1] for b in scene['blocks'] if b['type'] == 'image']
        self.assertEqual(photos, ['autumn-menu.webp', 'two-dango-toast.webp', 'group-two-dango.webp'])
        markup = event.render_conversations({**self.data, 'conversationSections': [scene]})
        self.assertIn('トリック・オア・トリート！！🎃', markup)
        self.assertIn('<span class="hw-avatar" aria-hidden="true">皆</span>', markup)
        self.assertIn('「美味しかったです！」', markup)

    def test_dialogue_detail_is_escaped(self):
        block = {'type': 'dialogue', 'speaker': 'ほのちゃん', 'speakerDetail': '<img src=x onerror=alert(1)>', 'text': '会話'}
        markup = event.render_block(block, self.data['participants'])
        self.assertIn('&lt;img src=x onerror=alert(1)&gt;', markup)
        self.assertNotIn('<img src=x', markup)

    def test_public_event_registration(self):
        public = json.loads((ROOT / 'src/data/events.json').read_text(encoding='utf-8'))
        self.assertEqual(sum(x['slug'] == 'halloween-2026' for x in public), 1)
        self.assertIn('halloween-2026/', (ROOT / 'lounge/events/index.html').read_text(encoding='utf-8'))
        self.assertIn('https://mainichi-miru.com/lounge/events/halloween-2026/', (ROOT / 'sitemap.xml').read_text(encoding='utf-8'))
        self.assertIn('/lounge/events/halloween-2026/ /lounge/events/halloween-2026/index.html 200', (ROOT / '_redirects').read_text(encoding='utf-8'))

    def test_draft_remains_noindex(self):
        self.data['status'] = 'draft'
        event.validate_data(self.data)
        page = event.render_page(self.data)
        self.assertIn('content="noindex, nofollow, noarchive"', page)
        self.assertIn('class="hw-draft-banner"', page)

    def test_asset_path_cannot_escape_site(self):
        for value in ('../outside.webp', 'https://example.com/image.webp', '/image/test.webp'):
            with self.subTest(path=value):
                with self.assertRaises(ValueError):
                    event.local_path(value)


if __name__ == '__main__':
    unittest.main()
