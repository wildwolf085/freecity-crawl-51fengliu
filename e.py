import json
import os
from pathlib import Path
import shutil
import traceback
product_template = """
            <tr>
                <td>{id}</td>
                <td><img src="images/{image}"></td>
                <td>{desc}</td>
                <td>{price}</td>
                <td>{reviews}</td>
                <td>{link}</td>
            </tr>"""

def build_excel(title: str, rows: list):
    return "\n".join(["""<!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
        </head>
        <body>
            <table border="1" width="100%">
                <thead>
                    <tr>
                        <td>ID</td>
                        <td>图片</td>
                        <td>说明</td>
                        <td>价格</td>
                        <td>评论</td>
                        <td>链接</td>
                    </tr>
                </thead>
                <tbody>""",
        "\n".join(rows),
                """</tbody>
            </table>
        </body>
        </html>
        """])

def generate_html_from_json():
    # Get the base directory for JSON files
    data_dir = Path("./data")
    
    # HTML template
    

    # Product card template
    
    id = 10000
    ps = {}
    # Process each JSON file in the directory and subdirectories

    for json_path in data_dir.rglob("*.json"):
        try:
            # Create output directory if it doesn't exist
            output_dir = json_path.parent
            # Read JSON data
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            # Generate product cards
            products = []
            for item in data:
                
                # Extract name from URL (part after last / and before .html)
                name = item['url'].split('/')[-1].split('.')[0]
                if not name in ps:
                    id += 1
                    ps[name] = True
                    products.append(product_template.format(
                        id=id,
                        name=name,
                        image=item['image'],
                        desc=item['desc'],
                        price=item['price'],
                        reviews=item.get('reviews', '-'),
                        link=item['url']
                    ))
                    for variant in item.get('products', []):
                        name = variant['url'].split('/')[-1].split('.')[0]
                        if name in ps: continue
                        id += 1
                        ps[name] = True
                        products.append(product_template.format(
                            id=id,
                            name=name,
                            image=variant['image'],
                            desc=item['desc'],
                            price=item['price'],
                            reviews=item.get('reviews', '-'),
                            link=variant['url']
                        ))

            # Generate final HTML
            html = build_excel(json_path.stem, products)

            # Write HTML file
            output_file = output_dir / f"{json_path.stem}.html"
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(html)

            print(f"Generated HTML file: {output_file}")

        except Exception as e:
            traceback.print_exc()
            print(f"Error processing {json_path}: {str(e)}")

def prepare_data(root_dir: str):
    id = 100000
    total_cnt = 0
    for type in os.listdir(root_dir):
        type_dir = f"{root_dir}/{type}"
        if not os.path.isdir(type_dir): continue
        ps = {}
        for shop in os.listdir(type_dir):
            
            if shop=="images": continue
            data_dir = f"{type_dir}/{shop}"
            if not os.path.isdir(data_dir): continue

            items = []
            for json_path in Path(data_dir).rglob("*.json"):
                try:
                    # Read JSON data
                    with open(json_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    items.extend(data)
                except:
                    pass
            
            products = []

            for item in items:
                # Extract name from URL (part after last / and before .html)
                desc = item["desc"]
                price = item.get('price', '-')
                reviews = item.get('reviews', '-')
                for v in item.get('products', []):
                    if isinstance(v, str): continue
                    if v['url'] in ps: continue
                    ps[v['url']] = True
                    id += 1
                    products.append(
                        product_template.format(
                            id=id,
                            image=v['image'],
                            desc=desc,
                            price=price,
                            reviews=reviews,
                            link=v['url']
                        )
                    )
            
            cnt = len(products) 
            if cnt!=0:
                # Generate final HTML
                total_cnt += cnt
                html = build_excel(shop, products)
                # Write HTML file
                with open(f"{data_dir}.html", 'w', encoding='utf-8') as f:
                    f.write(html)

            print(f"\t{shop} - {cnt}")

    print(f"总 {total_cnt}. 终了!")

if __name__ == "__main__":
    prepare_data("./data")
