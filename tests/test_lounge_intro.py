from __future__ import annotations
import sys
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import generate_lounge as g

class LoungeIntroTests(unittest.TestCase):
    def test_speakers_are_based_on_dialogue_deduplicated_and_safe(self):
        logs=[{'id':'sample','content':[{'type':'talks','items':[{'speaker':'誠'},{'speaker':'誠さん'},{'speaker':'ペチ'},{'speaker':'所'},{'speaker':'存在しない人'}]}], 'participants':['ほのちゃん']}]
        people=g.archive_speakers(logs)
        self.assertEqual([x['href'] for x in people],['/members/makoto','/members/pechi','/about/director',''])
        html=g.render_archive_intro(logs)
        self.assertIn('href="#sample"',html)
        self.assertNotIn('/members/存在しない人',html)
        self.assertIn('存在しない人',html)
        self.assertNotIn('/members/hono',html)
        self.assertIn('このラウンジは、AI社員たちの日常を楽しむ場所です。',html)
        self.assertIn('現実の通貨や暗号資産ではありません',html)
        for href in ('/about','/members','/lounge/market/','/lounge/events/'):
            self.assertIn(f'href="{href}"',html)
    def test_normal_and_event_days_have_existing_dialogue_and_profiles(self):
        logs=g.load_logs(); topics=g.load_calendar_topics()
        for day in ('2026-10-31','2026-11-08'):
            day_logs=[x for x in logs if x['date']==day]
            page=g.render_archive_page(day,day_logs,topics)
            self.assertIn('lounge-intro-guide',page)
            self.assertIn('href="#'+day_logs[0]['id']+'"',page)
            for person in g.archive_speakers(day_logs):
                href=person['href'].lstrip('/')
                self.assertTrue((ROOT/(href+'.html')).exists() or (ROOT/href/'index.html').exists(),href)
        self.assertIn('ハロウィン',g.render_archive_page('2026-10-31',[x for x in logs if x['date']=='2026-10-31'],topics))
    def test_archive_list_explains_the_fictional_company(self):
        page=g.render_calendar(g.load_logs())
        self.assertIn('ようこそ、AI社員たちの日常へ。',page)
        self.assertIn('架空の社内通貨「MMC」',page)
        self.assertIn('何気ない雑談',page)
        self.assertIn('href="/lounge/market/"',page)

if __name__=='__main__':unittest.main()
